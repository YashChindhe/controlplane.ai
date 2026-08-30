import { Kafka, Producer } from 'kafkajs';
import { request as undiciRequest } from 'undici';

const kafkaBroker = process.env.KAFKA_BROKERS || 'localhost:19092';
const auditServiceUrl = process.env.AUDIT_SERVICE_URL || 'http://127.0.0.1:8002';

let producer: Producer | null = null;
const eventListeners: ((event: Record<string, any>) => void)[] = [];

export function subscribeToLocalEvents(listener: (event: Record<string, any>) => void) {
  eventListeners.push(listener);
  return () => {
    const idx = eventListeners.indexOf(listener);
    if (idx !== -1) {
      eventListeners.splice(idx, 1);
    }
  };
}

export async function initializeKafka(): Promise<void> {
  try {
    const kafka = new Kafka({
      clientId: 'controlplane-gateway',
      brokers: kafkaBroker.split(','),
      retry: {
        initialRetryTime: 300,
        retries: 3
      }
    });

    producer = kafka.producer();
    await producer.connect();
    console.log('Successfully connected to Kafka/Redpanda broker');
  } catch (error) {
    console.error('Failed to connect to Kafka/Redpanda broker — audit events will use HTTP fallback to audit-service:', error);
    // Do not crash — allow gateway to run without Kafka using HTTP fallback
    producer = null;
  }
}

/**
 * Publishes an audit event.
 * 
 * Priority order:
 * 1. Notify local WebSocket listeners (always — zero cost, real-time dashboard feed)
 * 2. Kafka/Redpanda (if connected) — for durable event streaming
 * 3. HTTP POST to audit-service /audit/ingest — fallback when Kafka is unavailable (local dev)
 * 
 * This ensures the Audit Vault UI always receives events regardless of whether
 * the full Kafka stack is running.
 */
export async function publishAuditEvent(event: Record<string, any>): Promise<void> {
  // 1. Always notify local WebSocket listeners for real-time dashboard Live Feed
  eventListeners.forEach(listener => {
    try {
      listener(event);
    } catch (err) {
      console.error('Error in local event listener:', err);
    }
  });

  // 2. Try Kafka producer first
  if (producer) {
    try {
      await producer.send({
        topic: 'audit-events',
        messages: [
          {
            key: event.tenantId,
            value: JSON.stringify(event),
          },
        ],
      });
      return; // Kafka succeeded — no need for HTTP fallback
    } catch (error) {
      console.error(`Failed to publish audit event ${event.eventId} to Kafka:`, error);
      // Fall through to HTTP fallback
    }
  }

  // 3. HTTP fallback: POST directly to audit-service
  // This runs in local dev when Kafka isn't available and ensures the Audit Vault UI
  // can still display events.
  try {
    await undiciRequest(`${auditServiceUrl}/audit/ingest`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(event),
      headersTimeout: 2000,
      bodyTimeout: 2000,
    });
  } catch (error) {
    // Non-fatal — audit event is already pushed to WebSocket listeners
    console.warn(`Audit event ${event.eventId} could not be persisted (Kafka and audit-service both unavailable). Event was delivered to connected WebSocket clients only.`);
  }
}

export async function shutdownKafka(): Promise<void> {
  if (producer) {
    try {
      await producer.disconnect();
      console.log('Kafka producer disconnected');
    } catch (error) {
      console.error('Failed to disconnect Kafka producer:', error);
    }
  }
}
