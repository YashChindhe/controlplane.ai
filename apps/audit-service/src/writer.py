import os
import json
import asyncio
from aiokafka import AIOKafkaConsumer
from elasticsearch import AsyncElasticsearch
import datetime

KAFKA_BROKERS = os.getenv("KAFKA_BROKERS", "localhost:19092")
ELASTICSEARCH_URL = os.getenv("ELASTICSEARCH_URL", "http://localhost:9200")
S3_WORM_DIR = os.getenv("S3_WORM_DIR", "./s3_worm_vault")

# Ensure WORM dir exists
os.makedirs(S3_WORM_DIR, exist_ok=True)

# Shared in-memory list for fallback/mock queries
LOCAL_EVENT_STORE = []

async def get_elasticsearch_client():
    try:
        es = AsyncElasticsearch(ELASTICSEARCH_URL)
        # Check health
        await es.ping()
        return es
    except Exception as e:
        print(f"Elasticsearch not reachable at {ELASTICSEARCH_URL}. Running with local fallback. Error: {e}")
        return None

async def archive_to_s3_worm(event: dict):
    # Simulated S3 Object Lock WORM: write immutable file.
    tenant_id = event.get("tenantId", "unknown-tenant")
    event_id = event.get("eventId", f"event-{datetime.datetime.utcnow().timestamp()}")
    
    tenant_dir = os.path.join(S3_WORM_DIR, tenant_id)
    os.makedirs(tenant_dir, exist_ok=True)
    
    filepath = os.path.join(tenant_dir, f"{event_id}.json")
    # Verify file doesn't exist to ensure WORM property
    if os.path.exists(filepath):
        print(f"WORM Violation: Event {event_id} already exists! Cannot overwrite.")
        return
        
    with open(filepath, "w") as f:
        json.dump(event, f, indent=2)
    print(f"Archived to WORM: {filepath}")

async def consume_events():
    es = await get_elasticsearch_client()
    
    consumer = AIOKafkaConsumer(
        "audit-events",
        bootstrap_servers=KAFKA_BROKERS,
        group_id="audit-service-consumer",
        auto_offset_reset="earliest"
    )
    
    try:
        await consumer.start()
        print("Kafka Consumer started successfully on topic 'audit-events'.")
        
        async for msg in consumer:
            try:
                event = json.loads(msg.value.decode("utf-8"))
                print(f"Received audit event: {event.get('eventId')}")
                
                # 1. Store in memory list for local fallback query
                LOCAL_EVENT_STORE.append(event)
                
                # 2. Index into Elasticsearch
                if es:
                    tenant_id = event.get("tenantId", "default").lower()
                    index_name = f"audit-events-{tenant_id}"
                    await es.index(
                        index=index_name,
                        id=event.get("eventId"),
                        document=event
                    )
                    print(f"Indexed to Elasticsearch index '{index_name}'")
                
                # 3. Write to WORM archive
                await archive_to_s3_worm(event)
                
            except Exception as e:
                print(f"Error processing Kafka message: {e}")
    except asyncio.CancelledError:
        print("Kafka consumer task cancelled.")
    except Exception as e:
        print(f"Kafka consumer error: {e}")
    finally:
        await consumer.stop()
        if es:
            await es.close()
