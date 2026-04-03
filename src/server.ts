import Fastify from 'fastify';
import { NodeConfig } from './config.js';
import Database from 'better-sqlite3';
import { registerListingRoutes } from './routes/listings.js';
import { registerFederationRoutes } from './routes/federation.js';
import { registerHealthRoutes } from './routes/health.js';
import { registerUIRoutes } from './routes/ui.js';
import { registerFlagRoutes } from './routes/flags.js';
import { registerApiKeyAuth } from './middleware/api-key.js';

export function createServer(db: Database.Database, config: NodeConfig) {
  const app = Fastify({ logger: false });

  // API key auth must be registered before routes
  registerApiKeyAuth(app, config);

  registerListingRoutes(app, db, config);
  registerFederationRoutes(app, db, config);
  registerHealthRoutes(app, db, config);
  registerUIRoutes(app, db, config);
  registerFlagRoutes(app, db, config);

  return app;
}
