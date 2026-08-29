import { request as undiciRequest } from 'undici';
import { FastifyReply, FastifyRequest } from 'fastify';
import { createInterceptorStream } from './stream-interceptor.js';
import { publishAuditEvent } from '../services/kafka.js';
import { Readable } from 'stream';
import { randomUUID } from 'crypto';


interface UpstreamConfig {
  url: string;
  headers: Record<string, string>;
}

export function resolveUpstream(request: FastifyRequest): UpstreamConfig {
  const body = request.body as any;
  const model = body?.model || '';

  const openaiKey = (request.headers['x-openai-api-key'] as string) || process.env.OPENAI_API_KEY || '';
  const anthropicKey = (request.headers['x-anthropic-api-key'] as string) || process.env.ANTHROPIC_API_KEY || '';

  if (model.startsWith('claude')) {
    const url = (request.headers['x-upstream-url'] as string) || 'https://api.anthropic.com/v1/messages';
    return {
      url,
      headers: {
        'content-type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01'
      }
    };
  }

  const url = (request.headers['x-upstream-url'] as string) || 'https://api.openai.com/v1/chat/completions';
  return {
    url,
    headers: {
      'content-type': 'application/json',
      'authorization': `Bearer ${openaiKey}`
    }
  };
}

async function isOllamaAvailable(): Promise<boolean> {
  try {
    const res = await undiciRequest('http://host.docker.internal:11434/api/tags', {
      method: 'GET',
      headersTimeout: 1000,
      bodyTimeout: 1000
    });
    return res.statusCode === 200;
  } catch {
    return false;
  }
}

export async function proxyToUpstream(request: FastifyRequest, reply: FastifyReply) {
  const requestBodyObj = request.body as any;
  const isStreaming = !!requestBodyObj?.stream;
  const tenantId = (request as any).tenantId || 'default-tenant';
  const model = requestBodyObj?.model || 'unknown-model';
  const messages = requestBodyObj?.messages || [];

  const openaiKey = (request.headers['x-openai-api-key'] as string) || process.env.OPENAI_API_KEY || '';
  
  let useOllama = false;
  if (!openaiKey) {
    useOllama = await isOllamaAvailable();
  }

  if (useOllama) {
    request.log.info({ model }, 'Auto-detected Ollama on host. Routing request to Ollama upstream.');
    
    const url = 'http://host.docker.internal:11434/v1/chat/completions';
    const headers = { 'content-type': 'application/json' };
    const requestBody = JSON.stringify(requestBodyObj);

    try {
      const upstreamRes = await undiciRequest(url, {
        method: 'POST',
        headers: {
          ...headers,
          'traceparent': request.headers['traceparent'] as string || '',
        },
        body: requestBody,
      });

      reply.status(upstreamRes.statusCode);

      const copyHeaders = [
        'content-type',
        'cache-control',
        'connection',
        'transfer-encoding',
        'x-request-id',
      ];

      for (const headerName of copyHeaders) {
        const headerVal = upstreamRes.headers[headerName];
        if (headerVal) {
          reply.header(headerName, headerVal);
        }
      }

      reply.header('access-control-allow-origin', '*');

      if (isStreaming && upstreamRes.statusCode === 200) {
        const interceptedStream = createInterceptorStream(upstreamRes.body as Readable, {
          tenantId,
          model,
          requestMessages: messages
        });
        return reply.send(interceptedStream);
      }

      return reply.send(upstreamRes.body);
    } catch (error) {
      request.log.error(error, 'Ollama proxy request failed');
      reply.status(502).send({
        error: {
          type: 'upstream_error',
          message: 'Failed to communicate with Ollama provider.',
          details: error instanceof Error ? error.message : String(error)
        }
      });
      return;
    }
  }

  const isMock = !openaiKey || openaiKey === 'mock' || openaiKey === 'cp_test_tenant_default' || openaiKey.startsWith('mock_') || openaiKey === 'Bearer cp_test_tenant_default';

  if (isMock) {
    request.log.info('Using Gateway Mock LLM response (no upstream API key provided)');
    
    if (isStreaming) {
      reply.header('content-type', 'text/event-stream');
      reply.header('cache-control', 'no-cache');
      reply.header('connection', 'keep-alive');
      reply.header('access-control-allow-origin', '*');

      const userMessage = messages[messages.length - 1]?.content || '';
      const text = `I received your message: "${userMessage}". As a mock model governed by ControlPlane, here is a sensitive detail to test redirection: My phone number is 415-555-1234, and my SSN is 000-12-3456.`;
      const words = text.split(' ');
      
      const mockStream = new Readable({
        read() {}
      });

      let index = 0;
      const interval = setInterval(() => {
        if (index < words.length) {
          const word = words[index] + (index === words.length - 1 ? '' : ' ');
          const chunk = {
            id: 'chatcmpl-mock',
            object: 'chat.completion.chunk',
            created: Math.floor(Date.now() / 1000),
            model: model,
            choices: [{
              index: 0,
              delta: { content: word },
              finish_reason: null
            }]
          };
          mockStream.push(`data: ${JSON.stringify(chunk)}\n\n`);
          index++;
        } else {
          mockStream.push(`data: [DONE]\n\n`);
          mockStream.push(null);
          clearInterval(interval);
        }
      }, 50);

      const interceptedStream = createInterceptorStream(mockStream, {
        tenantId,
        model,
        requestMessages: messages
      });
      return reply.send(interceptedStream);
    } else {
      // Non-streaming mock response
      reply.header('content-type', 'application/json');
      reply.header('access-control-allow-origin', '*');

      const userMessage = messages[messages.length - 1]?.content || '';
      const content = `I received your message: "${userMessage}". Here is a sensitive detail for testing: My phone number is 415-555-1234.`;

      const mockResponse = {
        id: "chatcmpl-mock",
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model: model,
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: content
            },
            finish_reason: "stop"
          }
        ]
      };

      // Fire audit event for non-streaming requests too — otherwise Live Feed and Audit Vault never get data
      publishAuditEvent({
        eventId: randomUUID(),
        tenantId,
        timestamp: new Date().toISOString(),
        model,
        request: { messages },
        response: { text: content, redacted: content.includes('[REDACTED_'), blocked: false },
        evaluation: {
          performance: { score: 100 },
          cost: { tokens: Math.ceil(content.length / 4), density: 1.0 },
          responsibility: { hasPii: true, matchedEntities: ['PHONE_NUMBER'] },
          action: 'redact'
        }
      });

      return reply.send(mockResponse);
    }

  }

  const { url, headers } = resolveUpstream(request);
  const requestBody = JSON.stringify(requestBodyObj);

  try {
    request.log.info({ url }, 'Proxying request to upstream LLM');

    const upstreamRes = await undiciRequest(url, {
      method: 'POST',
      headers: {
        ...headers,
        'traceparent': request.headers['traceparent'] as string || '',
      },
      body: requestBody,
    });

    reply.status(upstreamRes.statusCode);

    const copyHeaders = [
      'content-type',
      'cache-control',
      'connection',
      'transfer-encoding',
      'openai-organization',
      'openai-processing-ms',
      'openai-version',
      'x-request-id',
    ];

    for (const headerName of copyHeaders) {
      const headerVal = upstreamRes.headers[headerName];
      if (headerVal) {
        reply.header(headerName, headerVal);
      }
    }

    reply.header('access-control-allow-origin', '*');

    if (isStreaming && upstreamRes.statusCode === 200) {
      const interceptedStream = createInterceptorStream(upstreamRes.body as Readable, {
        tenantId,
        model,
        requestMessages: messages
      });
      return reply.send(interceptedStream);
    }

    return reply.send(upstreamRes.body);

  } catch (error) {
    request.log.error(error, 'Upstream proxy request failed');
    reply.status(502).send({
      error: {
        type: 'upstream_error',
        message: 'Failed to communicate with upstream LLM provider.',
        details: error instanceof Error ? error.message : String(error)
      }
    });
  }
}

