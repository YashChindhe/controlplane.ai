import { Kafka, Producer } from 'kafkajs';

const kafkaBroker = process.env.KAFKA_BROKERS || 'localhost:19092';

let producer: Producer | null = null;

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
    console.error('Failed to connect to Kafka/Redpanda broker:', error);
    // Do not crash the application; allow it to run without audit logging
    producer = null;
  }
}

export async function publishAuditEvent(event: Record<string, any>): Promise<void> {
  if (!producer) {
    console.warn('Kafka producer not connected. Audit event skipped:', event.eventId);
    return;
  }

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
  } catch (error) {
    console.error(`Failed to publish audit event ${event.eventId} to Kafka:`, error);
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
