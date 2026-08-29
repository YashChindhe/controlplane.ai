import { FastifyRequest, FastifyReply } from 'fastify';

export interface TenantConfig {
  tenantId: string;
  rateLimit: {
    max: number;
    timeWindow: number;
  };
  policySet: {
    guards: {
      performance: { enabled: boolean; threshold: number };
      cost: { enabled: boolean; threshold: number };
      responsibility: { enabled: boolean; threshold: number };
    };
  };
  modelRouting: {
    defaultModel: string;
    allowedModels: string[];
  };
}

declare module 'fastify' {
  interface FastifyRequest {
    tenantConfig?: TenantConfig;
  }
}

export async function tenantResolverMiddleware(request: FastifyRequest, reply: FastifyReply) {
  if (!request.tenantId) {
    reply.status(500).send({
      error: {
        type: 'internal_error',
        message: 'Tenant ID not found in request context. Ensure auth middleware runs first.'
      }
    });
    return;
  }

  // Stub configuration resolution. In the future, this will fetch from Postgres or Redis.
  const mockTenantConfig: TenantConfig = {
    tenantId: request.tenantId,
    rateLimit: {
      max: 100, // 100 requests
      timeWindow: 60 * 1000 // per minute
    },
    policySet: {
      guards: {
        performance: { enabled: true, threshold: 80 },
        cost: { enabled: true, threshold: 90 },
        responsibility: { enabled: true, threshold: 75 }
      }
    },
    modelRouting: {
      defaultModel: 'gpt-4o-mini',
      allowedModels: ['gpt-4o-mini', 'gpt-4o', 'claude-3-5-sonnet']
    }
  };

  request.tenantConfig = mockTenantConfig;
}
