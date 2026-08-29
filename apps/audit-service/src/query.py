from typing import List, Optional
import json
from src.writer import get_elasticsearch_client, LOCAL_EVENT_STORE


async def search_audit_events(
    tenant_id: str,
    query_str: Optional[str] = None,
    guard: Optional[str] = None,
    action: Optional[str] = None,
    severity: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    limit: int = 100
) -> List[dict]:
    """
    Search audit events from Elasticsearch (if available) or local in-memory store.
    
    The gateway emits events with this schema:
    {
        eventId, tenantId, timestamp, model,
        request: { messages },
        response: { text, redacted, blocked },
        evaluation: {
            performance: { score },
            cost: { tokens, density },
            responsibility: { hasPii, matchedEntities },
            action: "pass" | "flag" | "block" | "redact"
        }
    }
    
    The guard and action filter params map to evaluation.action and evaluation guard type.
    """
    es = await get_elasticsearch_client()
    if es:
        try:
            index_name = f"audit-events-{tenant_id.lower()}"
            must_clauses = [{"term": {"tenantId": tenant_id}}]

            if action:
                must_clauses.append({"term": {"evaluation.action": action}})
            if query_str:
                must_clauses.append({"multi_match": {"query": query_str, "fields": ["*"]}})

            if start_date or end_date:
                range_query: dict = {}
                if start_date:
                    range_query["gte"] = start_date
                if end_date:
                    range_query["lte"] = end_date
                must_clauses.append({"range": {"timestamp": range_query}})

            query = {
                "bool": {
                    "must": must_clauses
                }
            }

            res = await es.search(
                index=index_name,
                query=query,
                size=limit,
                sort=[{"timestamp": "desc"}]
            )

            await es.close()
            return [hit["_source"] for hit in res["hits"]["hits"]]
        except Exception as e:
            print(f"Error querying Elasticsearch: {e}. Falling back to memory store.")

    # Fallback to LOCAL_EVENT_STORE
    # The gateway event schema uses evaluation.action, not a top-level 'action' field.
    results = []
    for event in LOCAL_EVENT_STORE:
        # Tenant isolation — never cross-tenant
        if event.get("tenantId") != tenant_id:
            continue

        event_action = event.get("evaluation", {}).get("action", "")

        if action and event_action != action:
            continue

        # Guard filter: map to responsibility, performance, cost based on hasPii/score
        if guard:
            evaluation = event.get("evaluation", {})
            matched_guard = False
            if guard == "responsibility" and evaluation.get("responsibility", {}).get("hasPii"):
                matched_guard = True
            elif guard == "performance" and evaluation.get("performance", {}).get("score", 100) < 70:
                matched_guard = True
            elif guard == "cost" and evaluation.get("cost", {}).get("density", 1.0) < 0.5:
                matched_guard = True
            if not matched_guard:
                continue

        # Severity filter — derive from performance score and action
        if severity:
            evaluation = event.get("evaluation", {})
            perf_score = evaluation.get("performance", {}).get("score", 100)
            event_action_check = evaluation.get("action", "pass")
            derived_severity = "safe"
            if event_action_check == "block":
                derived_severity = "critical"
            elif event_action_check == "flag":
                derived_severity = "medium"
            elif event_action_check == "redact":
                derived_severity = "low"

            if severity not in (derived_severity, "all"):
                if not (severity == "critical" and perf_score < 40):
                    continue

        # Date range filtering
        timestamp_str = event.get("timestamp", "")
        if start_date and timestamp_str < start_date:
            continue
        if end_date and timestamp_str > end_date:
            continue

        # Basic full text search fallback
        if query_str:
            event_dump = json.dumps(event).lower()
            if query_str.lower() not in event_dump:
                continue

        results.append(event)

    # Sort by timestamp desc
    results.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
    return results[:limit]
