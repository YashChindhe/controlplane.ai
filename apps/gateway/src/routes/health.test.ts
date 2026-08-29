import { expect, test, describe, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import { healthRoutes } from './health.js';

describe('Health Routes', () => {
  const fastify = Fastify();

  beforeAll(async () => {
    await fastify.register(healthRoutes);
  });

  afterAll(async () => {
    await fastify.close();
  });

  test('/health returns healthy status', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: '/health'
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.status).toBe('healthy');
  });

  test('/ready returns ready status', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: '/ready'
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.status).toBe('ready');
  });
});
