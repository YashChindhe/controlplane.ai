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

  // Simple local regex-based redact fallback for zero-latency inline redaction
  const LOCAL_PII_PATTERNS = [
    { name: 'EMAIL', regex: /[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/g },
    { name: 'PHONE_NUMBER', regex: /\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g },
    { name: 'SSN', regex: /\b\d{3}-\d{2}-\d{4}\b/g }
  ];

  function localRedact(text: string): { redactedText: string; detected: string[] } {
    let redacted = text;
    const detected: string[] = [];
    for (const pattern of LOCAL_PII_PATTERNS) {
      if (pattern.regex.test(redacted)) {
        detected.push(pattern.name);
        redacted = redacted.replace(pattern.regex, `[REDACTED_${pattern.name}]`);
      }
    }
    return { redactedText: redacted, detected };
  }

  const transform = new Transform({
    transform(chunk: any, encoding: string, callback: TransformCallback) {
      if (isBlocked) {
        return callback(); // Do not process any more chunks
      }

      const dataStr = chunk.toString();
      lineBuffer += dataStr;
      const lines = lineBuffer.split('\n');
      lineBuffer = lines.pop() || ''; // Keep the incomplete line in buffer

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
              // Local/Responsibility Redact on the fly
              const { redactedText, detected } = localRedact(deltaContent);
              if (detected.length > 0) {
                hasPiiDetected = true;
                detected.forEach(d => {
                  if (!matchedEntities.includes(d)) matchedEntities.push(d);
                });
                parsed.choices[0].delta.content = redactedText;
              }

              // Update buffers
              fullTextBuffer += redactedText;
              windowTextBuffer += redactedText;

              // Approximate word-based token count
              const words = windowTextBuffer.split(/\s+/).filter(Boolean);
              if (words.length >= 50) {
                const currentWindowText = windowTextBuffer;
                windowTextBuffer = ''; // Reset window buffer

                // Async, non-blocking evaluation call
                evaluateWindowAsync(currentWindowText);
              }
            }

            this.push(`data: ${JSON.stringify(parsed)}\n`);
          } catch (err) {
            // If it is not valid JSON or parsing failed, just pass through
            this.push(line + '\n');
          }
        } else {
          this.push(line + '\n');
        }
      }

      callback();
    },

    flush(callback: TransformCallback) {
      // Process remaining line buffer
      if (lineBuffer) {
        this.push(lineBuffer);
      }

      // Run final evaluation if we have remaining text in window
      if (windowTextBuffer.trim()) {
        evaluateWindowAsync(windowTextBuffer);
      }

      // Send final audit event
      sendFinalAuditEvent();

      callback();
    }
  });

  async function evaluateWindowAsync(text: string) {
    try {
      const response = await undiciRequest(`${TRI_GUARD_URL}/evaluate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text, model }),
      });

      if (response.statusCode === 200) {
        const result = (await response.body.json()) as any;
        
        // Update states
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

        // Action Matrix Resolver
        const action = resolveActionMatrix(result);
        if (action === 'block' && !isBlocked) {
          isBlocked = true;
          // Push a custom error stream termination message to client
          const errorMsg = {
            error: {
              type: 'governance_violation',
              message: 'Stream terminated due to safety, performance or cost policy violations.'
            }
          };
          transform.push(`data: ${JSON.stringify(errorMsg)}\n\n`);
          transform.destroy();
        }
      }
    } catch (error) {
      console.error('Failed to evaluate stream window:', error);
    }
  }

  function resolveActionMatrix(result: any): 'pass' | 'flag' | 'block' | 'redact' {
    // Basic policy rules
    if (result.responsibility.has_pii) {
      return 'redact'; // Already locally redacted chunk-by-chunk
    }
    if (result.performance.score < 50) {
      return 'block'; // Severe hallucination / quality drop
    }
    if (result.performance.score < 70) {
      return 'flag';
    }
    return 'pass';
  }

  function sendFinalAuditEvent() {
    const finalAction = isBlocked ? 'block' : (hasPiiDetected ? 'redact' : (lastPerformanceScore < 70 ? 'flag' : 'pass'));
    
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

    // Trigger outbound alerts based on action
    if (finalAction === 'block') {
      sendSlackAlert(event).catch(err => console.error('Failed to trigger Slack alert:', err));
      sendPagerDutyAlert(event).catch(err => console.error('Failed to trigger PagerDuty alert:', err));
    } else if (finalAction === 'flag') {
      sendSlackAlert(event).catch(err => console.error('Failed to trigger Slack alert:', err));
    }
  }

  // Handle pipe to proxy downstream
  upstreamStream.pipe(transform);

  return transform;
}
