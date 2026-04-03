import { FastifyInstance } from 'fastify';
import Database from 'better-sqlite3';
import { NodeConfig } from '../config.js';

export function registerHealthRoutes(app: FastifyInstance, db: Database.Database, config: NodeConfig) {
  app.get('/health', () => {
    const localCount = db.prepare('SELECT COUNT(*) as count FROM listings WHERE isFederated = 0').get() as { count: number };
    const federatedCount = db.prepare('SELECT COUNT(*) as count FROM listings WHERE isFederated = 1').get() as { count: number };

    return {
      status: 'ok',
      nodeId: config.nodeId,
      nodeName: config.nodeName,
      mode: config.mode,
      localListings: localCount.count,
      federatedListings: federatedCount.count,
      peers: config.peers.map((p) => p.nodeId),
      license: config.license || null,
      verified: !!config.attestation,
    };
  });

  app.get('/peers', () => {
    const peers = db.prepare('SELECT * FROM peers').all();
    return { nodeId: config.nodeId, peers };
  });
}
