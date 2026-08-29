import { request as undiciRequest } from 'undici';
import { FastifyReply, FastifyRequest } from 'fastify';
import { createInterceptorStream } from './stream-interceptor.js';
import { Readable } from 'stream';

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

export async function proxyToUpstream(request: FastifyRequest, reply: FastifyReply) {
  const { url, headers } = resolveUpstream(request);
  const requestBodyObj = request.body as any;
  const requestBody = JSON.stringify(requestBodyObj);
  const isStreaming = !!requestBodyObj?.stream;
  const tenantId = (request as any).tenantId || 'default-tenant';
  const model = requestBodyObj?.model || 'unknown-model';
  const messages = requestBodyObj?.messages || [];

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

