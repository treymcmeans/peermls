import { fork, ChildProcess } from 'child_process';
import { rmSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { startVerificationService } from '../verify/service.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..', '..');
const entryPoint = join(__dirname, '..', 'index.ts');

const VERIFY_PORT = 4000;
const VERIFY_URL = `http://localhost:${VERIFY_PORT}`;

// Clean slate
rmSync(join(projectRoot, 'data'), { recursive: true, force: true });
mkdirSync(join(projectRoot, 'data'), { recursive: true });

interface NodeDef {
  NODE_ID: string;
  NODE_NAME: string;
  PORT: string;
  LICENSE_NUMBER: string;
  LICENSE_STATE: string;
  MODE: string;
}

const nodes: NodeDef[] = [
  {
    NODE_ID: 'homepoint',
    NODE_NAME: 'Homepoint Brokerage',
    PORT: '4001',
    LICENSE_NUMBER: '165855',
    LICENSE_STATE: 'AL',
    MODE: 'node',
  },
  {
    NODE_ID: 'node-beta',
    NODE_NAME: 'Beta Brokers',
    PORT: '4002',
    LICENSE_NUMBER: '',
    LICENSE_STATE: '',
    MODE: 'node',
  },
  {
    NODE_ID: 'node-gamma',
    NODE_NAME: 'Gamma Group',
    PORT: '4003',
    LICENSE_NUMBER: '',
    LICENSE_STATE: '',
    MODE: 'node',
  },
  {
    NODE_ID: 'aggregator',
    NODE_NAME: 'PeerMLS Aggregator',
    PORT: '4010',
    LICENSE_NUMBER: '',
    LICENSE_STATE: '',
    MODE: 'aggregator',
  },
];

const brokerNodes = nodes.filter((n) => n.MODE === 'node');
const aggregatorNodes = nodes.filter((n) => n.MODE === 'aggregator');

async function main() {
  // Step 1: Start verification service
  console.log('--- Starting Verification Service (Live State Database) ---\n');
  const verifyApp = await startVerificationService(VERIFY_PORT, join(projectRoot, 'data', 'verify-keys'));

  // Step 2: Verify licenses
  console.log('\n--- Verifying Broker Licenses ---\n');

  const attestations: Record<string, string> = {};

  for (const node of brokerNodes) {
    if (!node.LICENSE_NUMBER || !node.LICENSE_STATE) {
      console.log(`  ${node.NODE_NAME}: skipped (no license configured)`);
      continue;
    }

    const res = await fetch(`${VERIFY_URL}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nodeId: node.NODE_ID,
        license: node.LICENSE_NUMBER,
        state: node.LICENSE_STATE,
      }),
    });
    const data = await res.json() as any;
    if (data.verified) {
      attestations[node.NODE_ID] = data.attestation;
      console.log(`  ${data.name}: VERIFIED (${data.rawLicenseType}, ${data.state}-${data.licenseNumber}, ${data.city})`);
    } else {
      console.log(`  ${node.NODE_NAME}: REJECTED - ${data.error}`);
    }
  }

  // Step 3: Start all nodes
  console.log('\n--- Starting Nodes ---\n');

  const children: ChildProcess[] = [];

  for (const node of nodes) {
    // Aggregators peer with all broker nodes. Broker nodes peer with each other + aggregator.
    const peerTargets = nodes.filter((n) => n.NODE_ID !== node.NODE_ID);
    const peers = peerTargets.map((n) => `${n.NODE_ID}|http://localhost:${n.PORT}`).join(',');

    const child = fork(entryPoint, [], {
      cwd: projectRoot,
      env: {
        ...process.env,
        NODE_ID: node.NODE_ID,
        NODE_NAME: node.NODE_NAME,
        PORT: node.PORT,
        DB_PATH: `./data/${node.NODE_ID}.db`,
        PEERS: peers,
        ATTESTATION: attestations[node.NODE_ID] || '',
        TRUSTED_ISSUERS: VERIFY_URL,
        LICENSE_NUMBER: node.LICENSE_NUMBER,
        LICENSE_STATE: node.LICENSE_STATE,
        LICENSE_TYPE: 'broker',
        NODE_MODE: node.MODE,
      },
      execArgv: ['--import', 'tsx'],
      stdio: 'inherit',
    });
    children.push(child);
  }

  console.log('\n--- PeerMLS Cluster ---');
  console.log('Verification:');
  console.log(`  Service: ${VERIFY_URL}`);
  console.log(`  JWKS:    ${VERIFY_URL}/.well-known/jwks.json`);
  console.log(`  Log:     ${VERIFY_URL}/transparency-log`);
  console.log('\nBrokerage Nodes:');
  for (const n of brokerNodes) {
    const verified = !!attestations[n.NODE_ID];
    const licenseInfo = n.LICENSE_NUMBER ? `[${n.LICENSE_STATE}-${n.LICENSE_NUMBER}]` : '[no license]';
    console.log(`  ${n.NODE_NAME} (${n.NODE_ID}) -> http://localhost:${n.PORT} ${licenseInfo} ${verified ? 'VERIFIED' : 'UNVERIFIED'}`);
  }
  console.log('\nAggregator Nodes:');
  for (const n of aggregatorNodes) {
    console.log(`  ${n.NODE_NAME} (${n.NODE_ID}) -> http://localhost:${n.PORT} [read-only, no license required]`);
  }
  console.log('\nEndpoints (brokerage nodes):');
  console.log('  GET  /health                    Node status');
  console.log('  GET  /ui                        Web interface');
  console.log('  GET  /api/v1/listings            All listings');
  console.log('  POST /api/v1/listings            Create listing');
  console.log('  GET  /api/v1/stats               Listing statistics');
  console.log('  GET  /federation/v1/listings     Peer sync endpoint');
  console.log('\nEndpoints (aggregator):');
  console.log(`  GET  http://localhost:${aggregatorNodes[0]?.PORT}/ui                  Aggregator dashboard`);
  console.log(`  GET  http://localhost:${aggregatorNodes[0]?.PORT}/api/v1/listings      Full network search`);
  console.log(`  GET  http://localhost:${aggregatorNodes[0]?.PORT}/api/v1/stats         Network-wide stats`);
  console.log('\nSearch params: ?city=&state=&zip=&minPrice=&maxPrice=&minBeds=&minBaths=&propertyType=&agent=&office=&q=&status=&limit=&offset=');
  console.log(`\nVerification: POST ${VERIFY_URL}/verify`);
  console.log('\nPress Ctrl+C to stop all nodes.\n');

  function shutdown() {
    console.log('\nShutting down cluster...');
    for (const child of children) {
      child.kill('SIGTERM');
    }
    verifyApp.close();
    process.exit(0);
  }

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('Failed to start cluster:', err);
  process.exit(1);
});
