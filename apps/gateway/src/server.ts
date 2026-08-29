import Fastify from 'fastify';
import { onRequestHook, onResponseHook } from './middleware/request-log.js';
import { registerRateLimiter } from './middleware/rate-limiter.js';
import { healthRoutes } from './routes/health.js';
import { chatRoutes } from './routes/chat.js';
import { initializeKafka, shutdownKafka } from './services/kafka.js';

const fastify = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    serializers: {
      req(req) {
        return {
          method: req.method,
          url: req.url,
          headers: {
            host: req.headers.host,
          }
        };
      }
    }
  }
});

// Register request logging hooks
fastify.addHook('onRequest', onRequestHook);
fastify.addHook('onResponse', onResponseHook);

// Health routes
await fastify.register(healthRoutes);

// Register Rate Limiting
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
await registerRateLimiter(fastify, redisUrl);

// Chat routes
await fastify.register(chatRoutes);

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const host = process.env.HOST || '0.0.0.0';

// Register shutdown hook
fastify.addHook('onClose', async () => {
  await shutdownKafka();
});

try {
  await initializeKafka();
  await fastify.listen({ port, host });
  fastify.log.info(`Gateway server listening on http://${host}/${port}`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}

