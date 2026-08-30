import uvicorn
from fastapi import FastAPI, Depends, Header, Query, HTTPException
from fastapi.responses import StreamingResponse
from contextlib import asynccontextmanager
import asyncio
from typing import List, Optional, Any, Dict
import io
import csv
import json

from src.writer import consume_events, LOCAL_EVENT_STORE
from src.query import search_audit_events

kafka_task = None

from fastapi.middleware.cors import CORSMiddleware

@asynccontextmanager
async def lifespan(app: FastAPI):
    global kafka_task
    # Start Kafka Consumer in background — fails gracefully if Kafka not available
    kafka_task = asyncio.create_task(consume_events())
    yield
    # Cancel Kafka consumer on shutdown
    if kafka_task:
        kafka_task.cancel()
        try:
            await kafka_task
        except asyncio.CancelledError:
            pass

app = FastAPI(
    title="ControlPlane Audit Service",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health_check():
    return {"status": "healthy", "event_count": len(LOCAL_EVENT_STORE)}

@app.post("/audit/ingest")
async def ingest_audit_event(event: Dict[str, Any]):
    """
    Direct HTTP ingestion endpoint for audit events.
    Used as fallback when Kafka is unavailable (local dev without Docker infrastructure).
    The gateway posts audit events here when Kafka producer is not connected.
    This ensures the Audit Vault UI always has data to display.
    """
    if not event.get("eventId"):
        raise HTTPException(status_code=400, detail="Event must contain eventId")

    # Store in local in-memory store — same store as Kafka consumer uses
    LOCAL_EVENT_STORE.append(event)

    # Also write to WORM archive
    from src.writer import archive_to_s3_worm, get_elasticsearch_client
    await archive_to_s3_worm(event)

    # Try to index in Elasticsearch if available
    es = await get_elasticsearch_client()
    if es:
        try:
            tenant_id = event.get("tenantId", "default").lower()
            index_name = f"audit-events-{tenant_id}"
            await es.index(index=index_name, id=event.get("eventId"), document=event)
        except Exception as e:
            print(f"Failed to index ingested event to Elasticsearch: {e}")
        finally:
            await es.close()

    return {"status": "ingested", "eventId": event.get("eventId")}

@app.get("/audit")
async def get_audit_logs(
    tenant_id: str = Header(..., alias="tenant-id"),
    q: Optional[str] = Query(None),
    guard: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    limit: int = Query(100)
):
    events = await search_audit_events(
        tenant_id=tenant_id,
        query_str=q,
        guard=guard,
        action=action,
        severity=severity,
        start_date=start_date,
        end_date=end_date,
        limit=limit
    )
    return {"events": events}

@app.delete("/audit")
async def clear_audit_logs(
    tenant_id: str = Header(..., alias="tenant-id")
):
    global LOCAL_EVENT_STORE
    # Remove all events for this tenant from memory
    LOCAL_EVENT_STORE[:] = [e for e in LOCAL_EVENT_STORE if e.get("tenantId") != tenant_id]

    # Dynamically update the backend persistent storage by deleting the WORM vault files
    import shutil
    import os
    from src.writer import S3_WORM_DIR
    tenant_dir = os.path.join(S3_WORM_DIR, tenant_id)
    if os.path.exists(tenant_dir):
        try:
            shutil.rmtree(tenant_dir)
            print(f"Dynamically deleted persistent WORM vault for tenant: {tenant_id}")
        except Exception as e:
            print(f"Failed to delete WORM vault: {e}")

    from src.writer import get_elasticsearch_client
    es = await get_elasticsearch_client()
    if es:
        try:
            index_name = f"audit-events-{tenant_id.lower()}"
            await es.indices.delete(index=index_name, ignore_unavailable=True)
        except Exception as e:
            print(f"Failed to delete ES index: {e}")
        finally:
            await es.close()

    return {"status": "cleared", "message": f"Cleared all audit logs for tenant {tenant_id}"}

@app.get("/audit/export")
async def export_audit_logs(
    format: str = Query("csv"),
    tenant_id: str = Header(..., alias="tenant-id"),
    q: Optional[str] = Query(None),
    guard: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None)
):
    events = await search_audit_events(
        tenant_id=tenant_id,
        query_str=q,
        guard=guard,
        action=action,
        severity=severity,
        start_date=start_date,
        end_date=end_date,
        limit=1000
    )

    if format == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["Event ID", "Timestamp", "Tenant ID", "Model", "Action", "Performance Score", "Cost Tokens", "Has PII", "Matched Entities"])
        for e in events:
            evaluation = e.get("evaluation", {})
            writer.writerow([
                e.get("eventId"),
                e.get("timestamp"),
                e.get("tenantId"),
                e.get("model"),
                evaluation.get("action"),
                evaluation.get("performance", {}).get("score"),
                evaluation.get("cost", {}).get("tokens"),
                evaluation.get("responsibility", {}).get("hasPii"),
                json.dumps(evaluation.get("responsibility", {}).get("matchedEntities", []))
            ])
        output.seek(0)
        return StreamingResponse(
            io.BytesIO(output.getvalue().encode("utf-8")),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=audit_export.csv"}
        )
    elif format == "json":
        return {"events": events}
    else:
        raise HTTPException(status_code=400, detail="Invalid export format. Must be 'csv' or 'json'.")

if __name__ == "__main__":
    uvicorn.run("src.main:app", host="0.0.0.0", port=8002, reload=True)
