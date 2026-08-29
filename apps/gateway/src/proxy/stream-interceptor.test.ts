import { expect, test, describe, vi } from 'vitest';
import { Readable } from 'stream';
import { createInterceptorStream } from './stream-interceptor.js';

// Mock the undici request for evaluate endpoint
vi.mock('undici', () => {
  return {
    request: vi.fn().mockImplementation(async (url, options) => {
      const body = JSON.parse(options.body);
      const text = body.text;
      
      // Stub evaluate logic
      let score = 85.0;
      if (text.includes('terrible response') || text.includes('hallucination')) {
        score = 40.0; // trigger block
      }

      return {
        statusCode: 200,
        body: {
          json: async () => ({
            performance: { score },
            cost: { tokens: 10, density: 0.8 },
            responsibility: {
              has_pii: text.includes('@'),
              matched_entities: text.includes('@') ? ['EMAIL'] : []
            }
          })
        }
      };
    })
  };
});

// Mock kafka to avoid actual connection in unit tests
vi.mock('../services/kafka.js', () => {
  return {
    publishAuditEvent: vi.fn()
  };
});

describe('Stream Interceptor', () => {
  test('passes through normal SSE messages unchanged', async () => {
    const upstream = new Readable();
    upstream.push('data: {"choices":[{"delta":{"content":"Hello "}}]}\n');
    upstream.push('data: {"choices":[{"delta":{"content":"world!"}}]}\n');
    upstream.push('data: [DONE]\n');
    upstream.push(null);

    const intercepted = createInterceptorStream(upstream, {
      tenantId: 'test-tenant',
      model: 'gpt-4',
      requestMessages: []
    });

    const chunks: string[] = [];
    for await (const chunk of intercepted) {
      chunks.push(chunk.toString());
    }

    const fullResult = chunks.join('');
    expect(fullResult).toContain('Hello');
    expect(fullResult).toContain('world!');
    expect(fullResult).toContain('[DONE]');
  });

  test('redacts emails inline', async () => {
    const upstream = new Readable();
    upstream.push('data: {"choices":[{"delta":{"content":"My email is "}}]}\n');
    upstream.push('data: {"choices":[{"delta":{"content":"john.doe@example.com"}}]}\n');
    upstream.push('data: [DONE]\n');
    upstream.push(null);

    const intercepted = createInterceptorStream(upstream, {
      tenantId: 'test-tenant',
      model: 'gpt-4',
      requestMessages: []
    });

    const chunks: string[] = [];
    for await (const chunk of intercepted) {
      chunks.push(chunk.toString());
    }

    const fullResult = chunks.join('');
    expect(fullResult).toContain('My email is');
    expect(fullResult).toContain('[REDACTED_EMAIL]');
    expect(fullResult).not.toContain('john.doe@example.com');
  });
});
