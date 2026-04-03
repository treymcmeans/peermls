import { mkdirSync } from 'fs';
import { dirname } from 'path';
import { loadConfig } from './config.js';
import { createDatabase } from './db/database.js';
import { createServer } from './server.js';
import { SyncEngine } from './sync/sync-engine.js';

const config = loadConfig();

// Ensure data directory exists
mkdirSync(dirname(config.dbPath), { recursive: true });

const db = createDatabase(config.dbPath);
const server = createServer(db, config);
const sync = new SyncEngine(db, config);

server.listen({ port: config.port, host: '0.0.0.0' }, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  const modeLabel = config.mode === 'aggregator' ? ' (aggregator, read-only)' : '';
  console.log(`[${config.nodeId}] ${config.nodeName} listening at ${address}${modeLabel}`);
  sync.start();
});

process.on('SIGTERM', () => {
  sync.stop();
  server.close();
  db.close();
});

process.on('SIGINT', () => {
  sync.stop();
  server.close();
  db.close();
});
