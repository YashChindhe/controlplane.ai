from typing import List, Optional
import datetime
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
    es = await get_elasticsearch_client()
    if es:
        try:
            # Query Elasticsearch
            index_name = f"audit-events-{tenant_id.lower()}"
            must_clauses = [{"term": {"tenantId": tenant_id}}]
            
            if guard:
                must_clauses.append({"term": {"guard": guard}})
            if action:
                must_clauses.append({"term": {"action": action}})
            if severity:
                must_clauses.append({"term": {"severity": severity}})
            if query_str:
                must_clauses.append({"multi_match": {"query": query_str, "fields": ["*"]}})
                
            if start_date or end_date:
                range_query = {}
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
    results = []
    for event in LOCAL_EVENT_STORE:
        if event.get("tenantId") != tenant_id:
            continue
        if guard and event.get("guard") != guard:
            continue
        if action and event.get("action") != action:
            continue
        if severity and event.get("severity") != severity:
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
