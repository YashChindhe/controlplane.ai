import { FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';

declare module 'fastify' {
  interface FastifyRequest {
    startTime?: bigint;
  }
}

function computeHash(content: any): string {
  if (!content) return '';
  const str = typeof content === 'string' ? content : JSON.stringify(content);
  return crypto.createHash('sha256').update(str).digest('hex');
}

export function onRequestHook(request: FastifyRequest, reply: FastifyReply, done: () => void) {
  request.startTime = process.hrtime.bigint();
  
  const reqId = request.id;
  const tenantId = request.tenantId || 'unauthenticated';
  const method = request.method;
  const url = request.url;
  
  const bodyHash = request.body ? computeHash(request.body) : undefined;

  request.log.info({
    type: 'request_ingress',
    requestId: reqId,
    tenantId,
    method,
    url,
    bodyHash,
    headers: {
      host: request.headers.host,
      userAgent: request.headers['user-agent'],
    }
  }, `Incoming request: ${method} ${url}`);
  done();
}

export function onResponseHook(request: FastifyRequest, reply: FastifyReply, done: () => void) {
  const reqId = request.id;
  const tenantId = request.tenantId || 'unauthenticated';
  
  const start = request.startTime;
  const durationMs = start ? Number(process.hrtime.bigint() - start) / 1e6 : undefined;

  request.log.info({
    type: 'request_egress',
    requestId: reqId,
    tenantId,
    statusCode: reply.statusCode,
    durationMs: durationMs ? Math.round(durationMs) : undefined,
  }, `Response sent: ${reply.statusCode} (${durationMs ? Math.round(durationMs) : '?'}ms)`);
  done();
}
