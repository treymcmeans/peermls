import { generateKeyPair, exportJWK, importJWK, SignJWT, jwtVerify, JWK } from 'jose';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname } from 'path';
import { mkdirSync } from 'fs';

export interface KeyPair {
  privateKey: CryptoKey;
  publicKey: CryptoKey;
  publicJwk: JWK;
}

const ALG = 'ES256';

/** Generate a new ECDSA key pair for signing attestations */
export async function generateSigningKeys(): Promise<KeyPair> {
  const { privateKey, publicKey } = await generateKeyPair(ALG, { extractable: true });
  const publicJwk = await exportJWK(publicKey);
  publicJwk.alg = ALG;
  publicJwk.use = 'sig';
  publicJwk.kid = `peermls-${Date.now()}`;
  return { privateKey, publicKey, publicJwk };
}

/** Save keys to disk */
export async function saveKeys(keyDir: string, keys: KeyPair) {
  mkdirSync(keyDir, { recursive: true });
  const privateJwk = await exportJWK(keys.privateKey);
  writeFileSync(`${keyDir}/private.json`, JSON.stringify(privateJwk, null, 2));
  writeFileSync(`${keyDir}/public.json`, JSON.stringify(keys.publicJwk, null, 2));
}

/** Load keys from disk, or generate new ones */
export async function loadOrCreateKeys(keyDir: string): Promise<KeyPair> {
  const privatePath = `${keyDir}/private.json`;
  const publicPath = `${keyDir}/public.json`;

  if (existsSync(privatePath) && existsSync(publicPath)) {
    const privateJwk = JSON.parse(readFileSync(privatePath, 'utf-8'));
    const publicJwk = JSON.parse(readFileSync(publicPath, 'utf-8'));
    const privateKey = await importJWK(privateJwk, ALG) as CryptoKey;
    const publicKey = await importJWK(publicJwk, ALG) as CryptoKey;
    return { privateKey, publicKey, publicJwk };
  }

  const keys = await generateSigningKeys();
  await saveKeys(keyDir, keys);
  return keys;
}

/** Sign a license attestation JWT */
export async function signAttestation(
  privateKey: CryptoKey,
  issuer: string,
  claims: {
    nodeId: string;
    license: string;
    state: string;
    brokerName: string;
    licenseType: 'broker' | 'agent';
  }
): Promise<string> {
  const jwt = await new SignJWT({
    license: claims.license,
    state: claims.state,
    name: claims.brokerName,
    licenseType: claims.licenseType,
    status: 'active',
  })
    .setProtectedHeader({ alg: ALG })
    .setSubject(claims.nodeId)
    .setIssuer(issuer)
    .setIssuedAt()
    .setExpirationTime('90d')
    .sign(privateKey);

  return jwt;
}

/** Verify an attestation JWT against a set of trusted public keys */
export async function verifyAttestation(
  jwt: string,
  trustedKeys: { issuer: string; jwk: JWK }[]
): Promise<{ valid: boolean; claims?: any; issuer?: string; error?: string }> {
  for (const trusted of trustedKeys) {
    try {
      const publicKey = await importJWK(trusted.jwk, ALG) as CryptoKey;
      const { payload } = await jwtVerify(jwt, publicKey, {
        issuer: trusted.issuer,
      });
      return { valid: true, claims: payload, issuer: trusted.issuer };
    } catch {
      // Try next key
    }
  }
  return { valid: false, error: 'No trusted issuer could verify this attestation' };
}
