import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../middleware/auth.js';
import { tenantResolverMiddleware } from '../middleware/tenant.js';
import { proxyToUpstream } from '../proxy/upstream.js';
import { z } from 'zod';

const ChatCompletionSchema = z.object({
  model: z.string(),
  messages: z.array(
    z.object({
      role: z.enum(['system', 'user', 'assistant', 'tool']),
      content: z.string().nullable().optional(),
      name: z.string().optional(),
    })
  ),
  stream: z.boolean().optional().default(false),
  temperature: z.number().optional(),
  max_tokens: z.number().optional(),
});

export async function chatRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/v1/chat/completions',
    {
      preHandler: [authMiddleware, tenantResolverMiddleware],
      config: {
        rateLimit: {},
      },
    },
    async (request, reply) => {
      const parseResult = ChatCompletionSchema.safeParse(request.body);
      if (!parseResult.success) {
        reply.status(400).send({
          error: {
            type: 'invalid_request_error',
            message: 'Invalid request body schema.',
            details: parseResult.error.flatten()
          }
        });
        return;
      }

      await proxyToUpstream(request, reply);
    }
  );
}
