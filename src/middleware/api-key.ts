import { FastifyInstance } from 'fastify';
import { NodeConfig } from '../config.js';

/**
 * API key middleware for write endpoints.
 * If an API key is configured, POST/PATCH/DELETE requests to /api/ require it.
 * Read endpoints and federation endpoints remain open.
 */
export function registerApiKeyAuth(app: FastifyInstance, config: NodeConfig) {
  if (!config.apiKey) return;

  app.addHook('onRequest', (req, reply, done) => {
    // Only protect write operations on the broker API
    const isWrite = req.method === 'POST' || req.method === 'PATCH' || req.method === 'DELETE';
    const isBrokerApi = req.url.startsWith('/api/');

    if (isWrite && isBrokerApi) {
      const provided = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');

      if (provided !== config.apiKey) {
        reply.status(401).send({ error: 'Invalid or missing API key' });
        return;
      }
    }

    done();
  });
}
