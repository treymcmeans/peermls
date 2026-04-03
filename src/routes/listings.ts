import { FastifyInstance } from 'fastify';
import Database from 'better-sqlite3';
import { v4 as uuid } from 'uuid';
import { createListingSchema, updateListingSchema } from '../reso/validate.js';
import { ResoListing } from '../reso/types.js';
import { NodeConfig } from '../config.js';

/** Parse photos JSON from SQLite text column */
function parsePhotos(row: any): any {
  if (!row) return row;
  if (row.photos && typeof row.photos === 'string') {
    try { row.photos = JSON.parse(row.photos); } catch { row.photos = []; }
  } else if (!row.photos) {
    row.photos = [];
  }
  return row;
}

function parsePhotosArray(rows: any[]): any[] {
  return rows.map(parsePhotos);
}

export function registerListingRoutes(app: FastifyInstance, db: Database.Database, config: NodeConfig) {
  const { nodeId, mode } = config;

  // List all listings with search/filter
  app.get('/api/v1/listings', (req) => {
    const query = req.query as Record<string, string>;
    let sql = 'SELECT * FROM listings WHERE 1=1';
    const params: any[] = [];

    if (query.visibility) {
      sql += ' AND visibility = ?';
      params.push(query.visibility);
    }
    if (query.originNodeId) {
      sql += ' AND originNodeId = ?';
      params.push(query.originNodeId);
    }
    if (query.status) {
      sql += ' AND standardStatus = ?';
      params.push(query.status);
    }
    if (query.city) {
      sql += ' AND LOWER(city) = LOWER(?)';
      params.push(query.city);
    }
    if (query.state) {
      sql += ' AND UPPER(stateOrProvince) = UPPER(?)';
      params.push(query.state);
    }
    if (query.zip) {
      sql += ' AND postalCode = ?';
      params.push(query.zip);
    }
    if (query.minPrice) {
      sql += ' AND listPrice >= ?';
      params.push(parseFloat(query.minPrice));
    }
    if (query.maxPrice) {
      sql += ' AND listPrice <= ?';
      params.push(parseFloat(query.maxPrice));
    }
    if (query.minBeds) {
      sql += ' AND bedroomsTotal >= ?';
      params.push(parseInt(query.minBeds));
    }
    if (query.minBaths) {
      sql += ' AND bathroomsTotalInteger >= ?';
      params.push(parseInt(query.minBaths));
    }
    if (query.propertyType) {
      sql += ' AND propertyType = ?';
      params.push(query.propertyType);
    }
    if (query.agent) {
      sql += ' AND LOWER(listAgentFullName) LIKE LOWER(?)';
      params.push(`%${query.agent}%`);
    }
    if (query.office) {
      sql += ' AND LOWER(listOfficeName) LIKE LOWER(?)';
      params.push(`%${query.office}%`);
    }
    if (query.q) {
      sql += ' AND (LOWER(streetAddress) LIKE LOWER(?) OR LOWER(city) LIKE LOWER(?) OR LOWER(publicRemarks) LIKE LOWER(?))';
      const term = `%${query.q}%`;
      params.push(term, term, term);
    }

    sql += ' ORDER BY modificationTimestamp DESC';

    const limit = Math.min(parseInt(query.limit || '100'), 500);
    const offset = parseInt(query.offset || '0');
    sql += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const listings = parsePhotosArray(db.prepare(sql).all(...params));

    // Include total count for pagination
    const countSql = sql.replace(/SELECT \*/, 'SELECT COUNT(*) as total').replace(/ ORDER BY.*$/, '').replace(/ LIMIT.*$/, '');
    const countParams = params.slice(0, -2); // remove limit/offset
    const total = (db.prepare(countSql).get(...countParams) as { total: number }).total;

    return { listings, total, limit, offset };
  });

  // Get single listing
  app.get('/api/v1/listings/:listingKey', (req) => {
    const { listingKey } = req.params as { listingKey: string };
    const listing = parsePhotos(db.prepare('SELECT * FROM listings WHERE listingKey = ?').get(listingKey));
    if (!listing) return { error: 'Not found', statusCode: 404 };
    return listing;
  });

  // Stats endpoint — useful for aggregators and dashboards
  app.get('/api/v1/stats', () => {
    const total = db.prepare('SELECT COUNT(*) as count FROM listings').get() as { count: number };
    const local = db.prepare('SELECT COUNT(*) as count FROM listings WHERE isFederated = 0').get() as { count: number };
    const federated = db.prepare('SELECT COUNT(*) as count FROM listings WHERE isFederated = 1').get() as { count: number };
    const byStatus = db.prepare('SELECT standardStatus, COUNT(*) as count FROM listings GROUP BY standardStatus').all() as { standardStatus: string; count: number }[];
    const byState = db.prepare('SELECT stateOrProvince, COUNT(*) as count FROM listings WHERE stateOrProvince IS NOT NULL GROUP BY stateOrProvince ORDER BY count DESC').all() as { stateOrProvince: string; count: number }[];
    const byOrigin = db.prepare('SELECT originNodeId, COUNT(*) as count FROM listings GROUP BY originNodeId ORDER BY count DESC').all() as { originNodeId: string; count: number }[];
    const priceRange = db.prepare('SELECT MIN(listPrice) as min, MAX(listPrice) as max, AVG(listPrice) as avg FROM listings WHERE listPrice IS NOT NULL').get() as { min: number; max: number; avg: number };

    return {
      mode,
      total: total.count,
      local: local.count,
      federated: federated.count,
      byStatus,
      byState,
      byOrigin,
      priceRange,
    };
  });

  // Create listing (blocked in aggregator mode)
  app.post('/api/v1/listings', (req, reply) => {
    if (mode === 'aggregator') {
      reply.status(403);
      return { error: 'Aggregator nodes are read-only' };
    }

    const parsed = createListingSchema.safeParse(req.body);
    if (!parsed.success) {
      reply.status(400);
      return { error: 'Validation failed', details: parsed.error.issues };
    }

    const now = new Date().toISOString();
    const listingKey = uuid();
    const data = parsed.data;

    db.prepare(`
      INSERT INTO listings (
        listingKey, originNodeId, listingId, standardStatus, visibility, propertyType,
        streetAddress, city, stateOrProvince, postalCode, listPrice,
        bedroomsTotal, bathroomsTotalInteger, livingArea, yearBuilt,
        listAgentFullName, listAgentLicense, listAgentLicenseState,
        listOfficeName, listOfficeLicense, listOfficeLicenseState,
        photos, latitude, longitude,
        closePrice, closeDate, originalListPrice,
        concessionsAmount, concessionsComments, buyerFinancing,
        buyerAgentFullName, buyerAgentLicense, buyerAgentLicenseState, buyerOfficeName,
        publicRemarks, modificationTimestamp, createdAt, isFederated
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `).run(
      listingKey, nodeId, data.listingId,
      data.standardStatus ?? 'Active', data.visibility ?? 'office', data.propertyType ?? 'Residential',
      data.streetAddress ?? null, data.city ?? null, data.stateOrProvince ?? null,
      data.postalCode ?? null, data.listPrice ?? null,
      data.bedroomsTotal ?? null, data.bathroomsTotalInteger ?? null,
      data.livingArea ?? null, data.yearBuilt ?? null,
      data.listAgentFullName ?? null, data.listAgentLicense ?? null, data.listAgentLicenseState ?? null,
      data.listOfficeName ?? null, data.listOfficeLicense ?? null, data.listOfficeLicenseState ?? null,
      data.photos ? JSON.stringify(data.photos) : null,
      data.latitude ?? null, data.longitude ?? null,
      data.closePrice ?? null, data.closeDate ?? null, data.originalListPrice ?? null,
      data.concessionsAmount ?? null, data.concessionsComments ?? null, data.buyerFinancing ?? null,
      data.buyerAgentFullName ?? null, data.buyerAgentLicense ?? null, data.buyerAgentLicenseState ?? null, data.buyerOfficeName ?? null,
      data.publicRemarks ?? null, now, now
    );

    reply.status(201);
    return parsePhotos(db.prepare('SELECT * FROM listings WHERE listingKey = ?').get(listingKey));
  });

  // Update listing (blocked in aggregator mode)
  app.patch('/api/v1/listings/:listingKey', (req, reply) => {
    if (mode === 'aggregator') {
      reply.status(403);
      return { error: 'Aggregator nodes are read-only' };
    }

    const { listingKey } = req.params as { listingKey: string };
    const existing = db.prepare('SELECT * FROM listings WHERE listingKey = ?').get(listingKey) as ResoListing | undefined;

    if (!existing) {
      reply.status(404);
      return { error: 'Not found' };
    }
    if (existing.originNodeId !== nodeId) {
      reply.status(403);
      return { error: 'Cannot modify federated listing' };
    }

    const parsed = updateListingSchema.safeParse(req.body);
    if (!parsed.success) {
      reply.status(400);
      return { error: 'Validation failed', details: parsed.error.issues };
    }

    const updates = parsed.data;
    const fields = Object.keys(updates).filter((k) => updates[k as keyof typeof updates] !== undefined);
    if (fields.length === 0) {
      return existing;
    }

    const setClauses = fields.map((f) => `${f} = ?`).join(', ');
    const values = fields.map((f) => {
      const val = updates[f as keyof typeof updates] ?? null;
      // Stringify photos array for SQLite
      if (f === 'photos' && Array.isArray(val)) return JSON.stringify(val);
      return val;
    });
    const now = new Date().toISOString();

    db.prepare(`UPDATE listings SET ${setClauses}, modificationTimestamp = ? WHERE listingKey = ?`)
      .run(...values, now, listingKey);

    return parsePhotos(db.prepare('SELECT * FROM listings WHERE listingKey = ?').get(listingKey));
  });

  // Delete listing (blocked in aggregator mode)
  app.delete('/api/v1/listings/:listingKey', (req, reply) => {
    if (mode === 'aggregator') {
      reply.status(403);
      return { error: 'Aggregator nodes are read-only' };
    }

    const { listingKey } = req.params as { listingKey: string };
    const existing = db.prepare('SELECT * FROM listings WHERE listingKey = ?').get(listingKey) as ResoListing | undefined;

    if (!existing) {
      reply.status(404);
      return { error: 'Not found' };
    }
    if (existing.originNodeId !== nodeId) {
      reply.status(403);
      return { error: 'Cannot delete federated listing' };
    }

    db.prepare('DELETE FROM listings WHERE listingKey = ?').run(listingKey);
    return { deleted: true };
  });
}
