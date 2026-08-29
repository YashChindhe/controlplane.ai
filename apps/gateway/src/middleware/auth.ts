import { FastifyRequest, FastifyReply } from 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    tenantId?: string;
    apiKey?: string;
  }
}

export async function authMiddleware(request: FastifyRequest, reply: FastifyReply) {
  let apiKey = request.headers['x-api-key'] as string;
  const authHeader = request.headers['authorization'];

  if (!apiKey && authHeader && authHeader.startsWith('Bearer ')) {
    apiKey = authHeader.substring(7);
  }

  if (!apiKey) {
    reply.status(401).send({
      error: {
        type: 'unauthorized',
        message: 'Missing API key. Provide it via x-api-key header or Authorization Bearer token.'
      }
    });
    return;
  }

  // Stub validation: accept any key matching cp_test_tenant_<tenant_id>
  if (apiKey.startsWith('cp_test_tenant_')) {
    const tenantId = apiKey.replace('cp_test_tenant_', '');
    if (!tenantId) {
      reply.status(401).send({
        error: {
          type: 'unauthorized',
          message: 'Invalid API key format.'
        }
      });
      return;
    }
    request.tenantId = tenantId;
    request.apiKey = apiKey;
  } else {
    reply.status(401).send({
      error: {
        type: 'unauthorized',
        message: 'Invalid API key. For testing, use format: cp_test_tenant_<tenant_id>.'
      }
    });
  }
}
