import { FastifyInstance } from 'fastify';
import Database from 'better-sqlite3';
import { v4 as uuid } from 'uuid';
import { z } from 'zod';
import { NodeConfig } from '../config.js';
import { ResoListing } from '../reso/types.js';

const createFlagSchema = z.object({
  field: z.string().min(1),
  reason: z.string().min(1),
  flaggedByAgent: z.string().nullable().optional(),
  flaggedByLicense: z.string().nullable().optional(),
});

const resolveFlagSchema = z.object({
  resolution: z.enum(['corrected', 'dismissed']),
  explanation: z.string().optional(),
});

export function registerFlagRoutes(app: FastifyInstance, db: Database.Database, config: NodeConfig) {
  // Get flags for a listing
  app.get('/api/v1/listings/:listingKey/flags', (req) => {
    const { listingKey } = req.params as { listingKey: string };
    const query = req.query as Record<string, string>;

    let sql = 'SELECT * FROM flags WHERE listingKey = ?';
    const params: any[] = [listingKey];

    if (query.status) {
      sql += ' AND status = ?';
      params.push(query.status);
    }

    sql += ' ORDER BY timestamp DESC';
    const flags = db.prepare(sql).all(...params);
    return { listingKey, flags, count: flags.length };
  });

  // Flag a listing for inaccurate data
  app.post('/api/v1/listings/:listingKey/flags', (req, reply) => {
    const { listingKey } = req.params as { listingKey: string };

    const listing = db.prepare('SELECT * FROM listings WHERE listingKey = ?').get(listingKey);
    if (!listing) {
      reply.status(404);
      return { error: 'Listing not found' };
    }

    const parsed = createFlagSchema.safeParse(req.body);
    if (!parsed.success) {
      reply.status(400);
      return { error: 'Validation failed', details: parsed.error.issues };
    }

    const data = parsed.data;
    const id = uuid();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO flags (id, listingKey, field, reason, flaggedBy, flaggedByAgent, flaggedByLicense, status, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?)
    `).run(
      id, listingKey, data.field, data.reason,
      config.nodeId,
      data.flaggedByAgent ?? null,
      data.flaggedByLicense ?? null,
      now
    );

    reply.status(201);
    return db.prepare('SELECT * FROM flags WHERE id = ?').get(id);
  });

  // Resolve a flag (originating broker only)
  // Two options: "corrected" (broker fixed the data) or "dismissed" (broker explains why it's right)
  // One response. No back-and-forth.
  app.patch('/api/v1/listings/:listingKey/flags/:flagId', (req, reply) => {
    const { listingKey, flagId } = req.params as { listingKey: string; flagId: string };

    // Only the originating broker can resolve flags on their listings
    const listing = db.prepare('SELECT * FROM listings WHERE listingKey = ?').get(listingKey) as ResoListing | undefined;
    if (!listing) {
      reply.status(404);
      return { error: 'Listing not found' };
    }
    if (listing.originNodeId !== config.nodeId) {
      reply.status(403);
      return { error: 'Only the originating broker can resolve flags' };
    }

    const flag = db.prepare('SELECT * FROM flags WHERE id = ? AND listingKey = ?').get(flagId, listingKey) as any;
    if (!flag) {
      reply.status(404);
      return { error: 'Flag not found' };
    }
    if (flag.status !== 'open') {
      reply.status(400);
      return { error: 'Flag is already resolved' };
    }

    const parsed = resolveFlagSchema.safeParse(req.body);
    if (!parsed.success) {
      reply.status(400);
      return { error: 'Validation failed', details: parsed.error.issues };
    }

    const data = parsed.data;
    const now = new Date().toISOString();

    const resolutionText = data.resolution === 'corrected'
      ? 'Data corrected'
      : data.explanation || 'Dismissed by originating broker';

    db.prepare('UPDATE flags SET status = ?, resolution = ?, resolvedAt = ? WHERE id = ?')
      .run(data.resolution, resolutionText, now, flagId);

    return db.prepare('SELECT * FROM flags WHERE id = ?').get(flagId);
  });
}
