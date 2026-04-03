import Fastify from 'fastify';
import { loadOrCreateKeys, signAttestation } from './keys.js';
import { checkLicenseLive, isStateSupported, getSupportedStates } from './scrapers/index.js';
import { mkdirSync } from 'fs';

/**
 * Verification Service
 *
 * Verifies broker and agent licenses against real state licensing
 * databases and issues signed attestation JWTs.
 *
 * Anyone can run one. All attestations are logged to a public
 * transparency log (append-only, auditable).
 */

interface AttestationLogEntry {
  timestamp: string;
  nodeId: string;
  license: string;
  state: string;
  name: string;
  type: string;
  attestationHash: string;
}

// In-memory transparency log for POC
// Production would use Sigstore Rekor or Google Trillian
const transparencyLog: AttestationLogEntry[] = [];

function hashAttestation(jwt: string): string {
  let hash = 0;
  for (let i = 0; i < jwt.length; i++) {
    const chr = jwt.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

/** Map AREC license types to our broker/agent enum */
function normalizeLicenseType(rawType: string): 'broker' | 'agent' {
  const lower = rawType.toLowerCase();
  if (lower.includes('company') || lower.includes('broker') || lower.includes('firm')) return 'broker';
  return 'agent';
}

export async function startVerificationService(port: number, keyDir: string) {
  mkdirSync(keyDir, { recursive: true });
  const keys = await loadOrCreateKeys(keyDir);
  const issuer = `http://localhost:${port}`;

  const app = Fastify({ logger: false });

  // JWKS endpoint — peers use this to verify attestations
  app.get('/.well-known/jwks.json', () => {
    return { keys: [keys.publicJwk] };
  });

  // Verify a license and issue an attestation
  app.post('/verify', async (req, reply) => {
    const { nodeId, license, state } = req.body as { nodeId: string; license: string; state: string };

    if (!nodeId || !license || !state) {
      reply.status(400);
      return { error: 'Missing required fields: nodeId, license, state' };
    }

    if (!isStateSupported(state)) {
      reply.status(400);
      return {
        error: `State ${state} not yet supported for live verification`,
        supportedStates: getSupportedStates(),
        verified: false,
      };
    }

    console.log(`[verify] Checking ${state} license ${license} for ${nodeId}...`);

    // Check against real state database
    const check = await checkLicenseLive(state, license);

    if (!check.valid) {
      console.log(`[verify] REJECTED: ${check.error}`);
      reply.status(403);
      return { error: check.error, verified: false, details: check };
    }

    const licenseType = normalizeLicenseType(check.licenseType || 'agent');

    // Issue signed attestation
    const attestation = await signAttestation(keys.privateKey, issuer, {
      nodeId,
      license: `${state}-${license}`,
      state,
      brokerName: check.name!,
      licenseType,
    });

    // Log to transparency log
    const logEntry: AttestationLogEntry = {
      timestamp: new Date().toISOString(),
      nodeId,
      license: `${state}-${license}`,
      state,
      name: check.name!,
      type: licenseType,
      attestationHash: hashAttestation(attestation),
    };
    transparencyLog.push(logEntry);

    console.log(`[verify] VERIFIED: ${check.name} (${licenseType}: ${state}-${license}, ${check.status})`);

    return {
      verified: true,
      name: check.name,
      licenseNumber: check.licenseNumber,
      licenseType,
      rawLicenseType: check.licenseType,
      status: check.status,
      city: check.city,
      state,
      attestation,
    };
  });

  // Public transparency log — anyone can audit
  app.get('/transparency-log', () => {
    return {
      entries: transparencyLog.length,
      log: transparencyLog,
    };
  });

  // Service info
  app.get('/info', () => {
    return {
      service: 'PeerMLS Verification Service',
      issuer,
      supportedStates: getSupportedStates(),
      attestationsIssued: transparencyLog.length,
      jwksUrl: `${issuer}/.well-known/jwks.json`,
      transparencyLogUrl: `${issuer}/transparency-log`,
    };
  });

  await app.listen({ port, host: '0.0.0.0' });
  console.log(`[verify] Verification service running at ${issuer}`);
  console.log(`[verify] Live verification for: ${getSupportedStates().join(', ')}`);
  console.log(`[verify] JWKS: ${issuer}/.well-known/jwks.json`);

  return app;
}
