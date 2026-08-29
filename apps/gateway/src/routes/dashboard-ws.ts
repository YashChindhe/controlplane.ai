import { FastifyInstance } from 'fastify';
import { subscribeToLocalEvents } from '../services/kafka.js';

export async function dashboardWebsocketRoutes(fastify: FastifyInstance) {
  fastify.get('/ws/events', { websocket: true }, (connection, req) => {
    fastify.log.info('Dashboard client connected to WebSocket live feed');

    const unsubscribe = subscribeToLocalEvents((event) => {
      connection.socket.send(JSON.stringify(event));
    });

    connection.socket.on('close', () => {
      fastify.log.info('Dashboard client disconnected from WebSocket live feed');
      unsubscribe();
    });

    connection.socket.on('error', (err) => {
      fastify.log.error(err, 'WebSocket error');
      unsubscribe();
    });
  });
}
