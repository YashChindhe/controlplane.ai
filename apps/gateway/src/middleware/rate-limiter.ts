import { FastifyInstance, FastifyRequest } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { Redis } from 'ioredis';

export async function registerRateLimiter(fastify: FastifyInstance, redisUrl: string | undefined) {
  let redisClient: Redis | undefined;

  if (redisUrl) {
    try {
      redisClient = new Redis(redisUrl, {
        maxRetriesPerRequest: null,
        lazyConnect: true,
        enableOfflineQueue: false,
        retryStrategy: () => null, // Do not retry connection if it fails
      });
      redisClient.on('error', (err: any) => {
        // Catch and log error quietly, fallback handles it
      });
      // Try to connect gracefully, fail back to in-memory if Redis is not available
      await redisClient.connect().catch((err: any) => {
        fastify.log.warn(`Redis connection failed: ${err.message}. Falling back to in-memory store for rate limiting.`);
        redisClient = undefined;
      });
    } catch (err: any) {
      fastify.log.warn(`Failed to initialize Redis: ${err instanceof Error ? err.message : String(err)}. Falling back to in-memory store.`);
      redisClient = undefined;
    }
  }

  await fastify.register(rateLimit as any, {
    global: false,
    redis: redisClient,
    keyGenerator: (request: FastifyRequest & { tenantId?: string }) => {
      return request.tenantId || request.ip;
    },
    max: async (request: FastifyRequest & { tenantConfig?: any }) => {
      return request.tenantConfig?.rateLimit?.max ?? 60;
    },
    timeWindow: async (request: FastifyRequest & { tenantConfig?: any }) => {
      return request.tenantConfig?.rateLimit?.timeWindow ?? 60000;
    },
    errorResponseBuilder: (request: FastifyRequest & { tenantId?: string }, context: any) => {
      return {
        error: {
          type: 'rate_limit_exceeded',
          message: `Rate limit exceeded. Maximum of ${context.max} requests per ${context.after} allowed.`,
          tenant_id: request.tenantId,
        }
      };
    }
  });
}

