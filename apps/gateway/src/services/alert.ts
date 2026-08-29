import { request } from 'undici';

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL || '';
const PAGERDUTY_ROUTING_KEY = process.env.PAGERDUTY_ROUTING_KEY || '';

export async function sendSlackAlert(event: Record<string, any>): Promise<void> {
  if (!SLACK_WEBHOOK_URL) {
    console.warn('Slack Webhook URL not configured. Skipping alert.');
    return;
  }

  const { eventId, tenantId, model, evaluation } = event;
  const action = evaluation?.action || 'flag';
  const performanceScore = evaluation?.performance?.score ?? 'N/A';
  const entities = evaluation?.responsibility?.matchedEntities || [];

  const text = `🚨 *ControlPlane Violation Alert* 🚨\n` +
               `*Event ID*: \`${eventId}\`\n` +
               `*Tenant ID*: \`${tenantId}\`\n` +
               `*Model*: \`${model}\`\n` +
               `*Action Taken*: *${action.toUpperCase()}*\n` +
               `*Performance Score*: \`${performanceScore}\`\n` +
               `*PII Entities Blocked/Redacted*: ${entities.length > 0 ? entities.join(', ') : 'None'}`;

  try {
    const response = await request(SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text }),
    });

    if (response.statusCode < 200 || response.statusCode >= 300) {
      console.error(`Failed to send Slack alert. Status code: ${response.statusCode}`);
    }
  } catch (error) {
    console.error('Error sending Slack alert:', error);
  }
}

export async function sendPagerDutyAlert(event: Record<string, any>): Promise<void> {
  if (!PAGERDUTY_ROUTING_KEY) {
    console.warn('PagerDuty Routing Key not configured. Skipping alert.');
    return;
  }

  const { eventId, tenantId, model, evaluation } = event;
  const action = evaluation?.action || 'flag';
  const performanceScore = evaluation?.performance?.score ?? 'N/A';

  const payload = {
    payload: {
      summary: `ControlPlane Policy Violation: ${action.toUpperCase()} action taken on tenant ${tenantId}`,
      timestamp: new Date().toISOString(),
      severity: 'critical',
      source: 'controlplane-gateway',
      component: 'gateway-stream-interceptor',
      group: 'security-compliance',
      class: 'policy-violation',
      custom_details: {
        eventId,
        tenantId,
        model,
        action,
        performanceScore,
        matchedEntities: evaluation?.responsibility?.matchedEntities || [],
      },
    },
    routing_key: PAGERDUTY_ROUTING_KEY,
    event_action: 'trigger',
    dedup_key: eventId,
  };

  try {
    const response = await request('https://events.pagerduty.com/v2/enqueue', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (response.statusCode < 200 || response.statusCode >= 300) {
      console.error(`Failed to send PagerDuty alert. Status code: ${response.statusCode}`);
    }
  } catch (error) {
    console.error('Error sending PagerDuty alert:', error);
  }
}
