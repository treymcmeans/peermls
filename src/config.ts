export interface PeerConfig {
  nodeId: string;
  baseUrl: string;
}

export interface LicenseConfig {
  number: string;
  state: string;
  type: 'broker' | 'agent';
}

export type NodeMode = 'node' | 'aggregator';

export interface NodeConfig {
  nodeId: string;
  nodeName: string;
  port: number;
  dbPath: string;
  peers: PeerConfig[];
  syncIntervalMs: number;
  license?: LicenseConfig;
  attestation?: string;
  trustedIssuers: string[];
  mode: NodeMode;
  apiKey: string | null;
}

export function loadConfig(): NodeConfig {
  const nodeId = process.env.NODE_ID || 'node-alpha';
  const nodeName = process.env.NODE_NAME || 'Alpha Realty';
  const port = parseInt(process.env.PORT || '4001', 10);
  const dbPath = process.env.DB_PATH || `./data/${nodeId}.db`;
  const syncIntervalMs = parseInt(process.env.SYNC_INTERVAL_MS || '5000', 10);

  let peers: PeerConfig[] = [];
  if (process.env.PEERS) {
    // Format: "nodeId|url,nodeId|url"
    peers = process.env.PEERS.split(',').map((p) => {
      const [id, ...urlParts] = p.split('|');
      return { nodeId: id, baseUrl: urlParts.join('|') };
    });
  }

  const license = process.env.LICENSE_NUMBER && process.env.LICENSE_STATE
    ? { number: process.env.LICENSE_NUMBER, state: process.env.LICENSE_STATE, type: (process.env.LICENSE_TYPE || 'broker') as 'broker' | 'agent' }
    : undefined;

  const attestation = process.env.ATTESTATION || undefined;

  const trustedIssuers = process.env.TRUSTED_ISSUERS
    ? process.env.TRUSTED_ISSUERS.split(',')
    : [];

  const mode = (process.env.NODE_MODE || 'node') as NodeMode;
  const apiKey = process.env.API_KEY || null;

  return { nodeId, nodeName, port, dbPath, peers, syncIntervalMs, license, attestation, trustedIssuers, mode, apiKey };
}
