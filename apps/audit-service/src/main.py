import uvicorn
from fastapi import FastAPI, Depends, Header, Query, HTTPException
from fastapi.responses import StreamingResponse
from contextlib import asynccontextmanager
import asyncio
from typing import List, Optional
import io
import csv
import json

from src.writer import consume_events
from src.query import search_audit_events

kafka_task = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global kafka_task
    # Start Kafka Consumer in background
    kafka_task = asyncio.create_task(consume_events())
    yield
    # Cancel Kafka consumer
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

@app.get("/health")
def health_check():
    return {"status": "healthy"}

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
        # Write headers
        writer.writerow(["Event ID", "Timestamp", "Guard", "Action", "Severity", "Metrics", "Triggered Rules"])
        for e in events:
            writer.writerow([
                e.get("eventId"),
                e.get("timestamp"),
                e.get("guard"),
                e.get("action"),
                e.get("severity"),
                json.dumps(e.get("metrics")),
                json.dumps(e.get("rulesTriggered"))
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
    uvicorn.run("main:app", host="0.0.0.0", port=8002, reload=True)
