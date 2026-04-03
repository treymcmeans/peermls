import { FastifyInstance } from 'fastify';
import Database from 'better-sqlite3';
import { NodeConfig } from '../config.js';
import { ResoListing } from '../reso/types.js';

export function registerFederationRoutes(app: FastifyInstance, db: Database.Database, config: NodeConfig) {
  // Serve network-visible listings to peers
  app.get('/federation/v1/listings', (req) => {
    const { since } = req.query as { since?: string };

    let listings: ResoListing[];
    if (since) {
      listings = db.prepare(
        'SELECT * FROM listings WHERE originNodeId = ? AND visibility = ? AND modificationTimestamp > ? ORDER BY modificationTimestamp ASC'
      ).all(config.nodeId, 'network', since) as ResoListing[];
    } else {
      listings = db.prepare(
        'SELECT * FROM listings WHERE originNodeId = ? AND visibility = ? ORDER BY modificationTimestamp ASC'
      ).all(config.nodeId, 'network') as ResoListing[];
    }

    // Parse photos JSON for federation response
    const parsed = listings.map((l: any) => {
      if (l.photos && typeof l.photos === 'string') {
        try { l.photos = JSON.parse(l.photos); } catch { l.photos = []; }
      } else if (!l.photos) {
        l.photos = [];
      }
      return l;
    });

    return {
      nodeId: config.nodeId,
      nodeName: config.nodeName,
      timestamp: new Date().toISOString(),
      listings: parsed,
    };
  });

  // Node info endpoint
  app.get('/federation/v1/node-info', () => {
    const count = db.prepare('SELECT COUNT(*) as count FROM listings WHERE originNodeId = ?').get(config.nodeId) as { count: number };
    const networkCount = db.prepare('SELECT COUNT(*) as count FROM listings WHERE originNodeId = ? AND visibility = ?').get(config.nodeId, 'network') as { count: number };

    return {
      nodeId: config.nodeId,
      nodeName: config.nodeName,
      totalListings: count.count,
      networkListings: networkCount.count,
      license: config.license || null,
      attestation: config.attestation || null,
    };
  });
}
