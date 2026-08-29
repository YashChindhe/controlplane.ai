import { FastifyInstance } from 'fastify';
import { subscribeToLocalEvents } from '../services/kafka.js';

export async function dashboardWebsocketRoutes(fastify: FastifyInstance) {
  fastify.get('/ws/events', { websocket: true }, (connection, req) => {
    fastify.log.info('Dashboard client connected to WebSocket live feed');

    const unsubscribe = subscribeToLocalEvents((event) => {
      // Guard: only send if socket is still open
      if (connection.socket.readyState === connection.socket.OPEN) {
        try {
          connection.socket.send(JSON.stringify(event));
        } catch (err) {
          fastify.log.error(err, 'Failed to send WebSocket event to dashboard client');
        }
      }
    });

    connection.socket.on('close', () => {
      fastify.log.info('Dashboard client disconnected from WebSocket live feed');
      unsubscribe();
    });

    connection.socket.on('error', (err: Error) => {
      fastify.log.error(err, 'WebSocket error on dashboard live feed');
      unsubscribe();
    });
  });
}
