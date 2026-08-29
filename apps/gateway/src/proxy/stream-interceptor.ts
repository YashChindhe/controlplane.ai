import { Readable, Transform, TransformCallback } from 'stream';
import { request as undiciRequest } from 'undici';
import { publishAuditEvent } from '../services/kafka.js';
import { sendSlackAlert, sendPagerDutyAlert } from '../services/alert.js';
import crypto from 'crypto';

const TRI_GUARD_URL = process.env.TRI_GUARD_URL || 'http://localhost:8000';

interface StreamInterceptorOptions {
  tenantId: string;
  model: string;
  requestMessages: any[];
}

export function createInterceptorStream(
  upstreamStream: Readable,
  options: StreamInterceptorOptions
): Readable {
  const { tenantId, model, requestMessages } = options;
  let lineBuffer = '';
  let fullTextBuffer = '';
  let windowTextBuffer = '';
  let totalTokenCount = 0;
  let hasPiiDetected = false;
  let isBlocked = false;

  // Track evaluation states
  let lastPerformanceScore = 100.0;
  let lastCostDensity = 1.0;
  let matchedEntities: string[] = [];

  /**
   * Performs inline PII detection and redaction.
   * CRITICAL: Do NOT use module-level regex objects with the /g flag.
   * The /g flag causes regex objects to maintain lastIndex across calls —
   * after .test() advances lastIndex, the next .replace() starts mid-string,
   * causing silent missed replacements. Use fresh instances every call.
   */
  function localRedact(text: string): { redactedText: string; detected: string[] } {
    let redacted = text;
    const detected: string[] = [];

    // Pattern sources — instantiated fresh on every call to avoid lastIndex contamination
    const patternDefs: { name: string; source: string }[] = [
      { name: 'EMAIL', source: '[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\\.[a-zA-Z0-9-.]+' },
      { name: 'PHONE_NUMBER', source: '(?:\\+?\\d{1,3}[.\\-\\s]?)?\\(?\\d{3}\\)?[.\\-\\s]?\\d{3}[.\\-\\s]?\\d{4}' },
      { name: 'SSN', source: '\\d{3}-\\d{2}-\\d{4}' },
    ];

    for (const def of patternDefs) {
      // Separate non-global regex for test (no lastIndex side effects)
      const testRegex = new RegExp(def.source);
      if (testRegex.test(redacted)) {
        detected.push(def.name);
        // Fresh global regex for the actual replacement pass
        const replaceRegex = new RegExp(def.source, 'g');
        redacted = redacted.replace(replaceRegex, `[REDACTED_${def.name}]`);
      }
    }
    return { redactedText: redacted, detected };
  }

  const transform = new Transform({
    transform(chunk: any, _encoding: string, callback: TransformCallback) {
      if (isBlocked) {
        return callback();
      }

      const dataStr = chunk.toString();
      lineBuffer += dataStr;
      const lines = lineBuffer.split('\n');
      lineBuffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
          this.push(line + '\n');
          continue;
        }

        if (trimmed.startsWith('data:')) {
          const dataContent = trimmed.slice(5).trim();
          if (dataContent === '[DONE]') {
            this.push(line + '\n');
            continue;
          }

          try {
            const parsed = JSON.parse(dataContent);
            const deltaContent = parsed.choices?.[0]?.delta?.content || '';

            if (deltaContent) {
              const { redactedText, detected } = localRedact(deltaContent);
              if (detected.length > 0) {
                hasPiiDetected = true;
                detected.forEach(d => {
                  if (!matchedEntities.includes(d)) matchedEntities.push(d);
                });
                parsed.choices[0].delta.content = redactedText;
              }

              fullTextBuffer += redactedText;
              windowTextBuffer += redactedText;

              const words = windowTextBuffer.split(/\s+/).filter(Boolean);
              if (words.length >= 50) {
                const currentWindowText = windowTextBuffer;
                windowTextBuffer = '';
                // Fire async, non-blocking — stream continues while evaluation runs
                evaluateWindowAsync(currentWindowText).catch(err =>
                  console.error('Tri-Guard evaluation error (non-blocking):', err)
                );
              }
            }

            this.push(`data: ${JSON.stringify(parsed)}\n`);
          } catch (_err) {
            // Invalid JSON chunk — pass through unchanged
            this.push(line + '\n');
          }
        } else {
          this.push(line + '\n');
        }
      }

      callback();
    },

    flush(callback: TransformCallback) {
      // Flush any remaining buffered line
      if (lineBuffer) {
        this.push(lineBuffer);
      }

      // Evaluate any remaining window content, then fire the audit event
      if (windowTextBuffer.trim()) {
        evaluateWindowAsync(windowTextBuffer)
          .then(() => {
            sendFinalAuditEvent();
            callback();
          })
          .catch(err => {
            console.error('Final window evaluation failed (fail-open):', err);
            sendFinalAuditEvent();
            callback();
          });
      } else {
        sendFinalAuditEvent();
        callback();
      }
    }
  });

  async function evaluateWindowAsync(text: string): Promise<void> {
    try {
      const response = await undiciRequest(`${TRI_GUARD_URL}/evaluate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text, model }),
      });

      if (response.statusCode === 200) {
        const result = (await response.body.json()) as any;

        lastPerformanceScore = result.performance.score;
        lastCostDensity = result.cost.density;
        totalTokenCount += result.cost.tokens;

        if (result.responsibility.has_pii) {
          hasPiiDetected = true;
          result.responsibility.matched_entities.forEach((entity: string) => {
            if (!matchedEntities.includes(entity)) {
              matchedEntities.push(entity);
            }
          });
        }

        const action = resolveActionMatrix(result);
        if (action === 'block' && !isBlocked) {
          isBlocked = true;
          const errorMsg = {
            error: {
              type: 'governance_violation',
              code: 'BLOCK_HIGH_RISK',
              message: 'Stream terminated due to safety, performance or cost policy violations.'
            }
          };
          transform.push(`data: ${JSON.stringify(errorMsg)}\n\n`);
          transform.destroy();
        }
      }
    } catch (error) {
      // Fail-open per rules.md: if Tri-Guard is unavailable, pass chunk through and emit audit event
      console.error('Tri-Guard service unavailable (fail-open):', error);
    }
  }

  function resolveActionMatrix(result: any): 'pass' | 'flag' | 'block' | 'redact' {
    if (result.responsibility.has_pii) {
      return 'redact'; // Already redacted inline above
    }
    if (result.performance.score < 50) {
      return 'block'; // Severe hallucination / quality drop
    }
    if (result.performance.score < 70) {
      return 'flag';
    }
    return 'pass';
  }

  function sendFinalAuditEvent(): void {
    const finalAction: string = isBlocked
      ? 'block'
      : hasPiiDetected
      ? 'redact'
      : lastPerformanceScore < 70
      ? 'flag'
      : 'pass';

    const event = {
      eventId: crypto.randomUUID(),
      tenantId,
      timestamp: new Date().toISOString(),
      model,
      request: {
        messages: requestMessages
      },
      response: {
        text: fullTextBuffer,
        redacted: hasPiiDetected,
        blocked: isBlocked
      },
      evaluation: {
        performance: {
          score: lastPerformanceScore
        },
        cost: {
          tokens: totalTokenCount || Math.max(1, Math.floor(fullTextBuffer.length / 4)),
          density: lastCostDensity
        },
        responsibility: {
          hasPii: hasPiiDetected,
          matchedEntities
        },
        action: finalAction
      }
    };

    publishAuditEvent(event);

    if (finalAction === 'block') {
      sendSlackAlert(event).catch(err => console.error('Slack alert failed:', err));
      sendPagerDutyAlert(event).catch(err => console.error('PagerDuty alert failed:', err));
    } else if (finalAction === 'flag') {
      sendSlackAlert(event).catch(err => console.error('Slack alert failed:', err));
    }
  }

  upstreamStream.pipe(transform);

  return transform;
}
