import Database from 'better-sqlite3';
import { NodeConfig } from '../config.js';
import { ResoListing } from '../reso/types.js';
import { verifyAttestation } from '../verify/keys.js';
import { JWK } from 'jose';

interface FederationResponse {
  nodeId: string;
  nodeName: string;
  timestamp: string;
  listings: ResoListing[];
}

interface NodeInfoResponse {
  nodeId: string;
  nodeName: string;
  attestation: string | null;
  license: { number: string; state: string } | null;
}

export class SyncEngine {
  private db: Database.Database;
  private config: NodeConfig;
  private interval: ReturnType<typeof setInterval> | null = null;
  private label: string;
  private verifiedPeers: Set<string> = new Set();
  private trustedKeys: { issuer: string; jwk: JWK }[] | null = null;

  constructor(db: Database.Database, config: NodeConfig) {
    this.db = db;
    this.config = config;
    this.label = `[${config.nodeId}]`;

    // Register peers in db
    const upsertPeer = this.db.prepare(
      'INSERT OR REPLACE INTO peers (nodeId, baseUrl, lastSyncAt) VALUES (?, ?, ?)'
    );
    for (const peer of config.peers) {
      const existing = this.db.prepare('SELECT lastSyncAt FROM peers WHERE nodeId = ?').get(peer.nodeId) as { lastSyncAt: string | null } | undefined;
      upsertPeer.run(peer.nodeId, peer.baseUrl, existing?.lastSyncAt ?? null);
    }
  }

  start() {
    console.log(`${this.label} Sync engine started (interval: ${this.config.syncIntervalMs}ms)`);
    this.interval = setInterval(() => this.syncAll(), this.config.syncIntervalMs);
    setTimeout(() => this.syncAll(), 2000);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  /** Fetch JWKS from all trusted issuers and cache them */
  private async loadTrustedKeys(): Promise<{ issuer: string; jwk: JWK }[]> {
    if (this.trustedKeys) return this.trustedKeys;

    const keys: { issuer: string; jwk: JWK }[] = [];
    for (const issuer of this.config.trustedIssuers) {
      try {
        const res = await fetch(`${issuer}/.well-known/jwks.json`);
        if (res.ok) {
          const jwks = await res.json() as { keys: JWK[] };
          for (const jwk of jwks.keys) {
            keys.push({ issuer, jwk });
          }
        }
      } catch {
        // Issuer might be down, skip
      }
    }
    this.trustedKeys = keys;

    // Re-fetch every 5 minutes
    setTimeout(() => { this.trustedKeys = null; }, 5 * 60 * 1000);

    return keys;
  }

  /** Verify a peer's attestation before syncing */
  private async verifyPeer(peerNodeId: string, baseUrl: string): Promise<boolean> {
    // Skip verification if no trusted issuers configured
    if (this.config.trustedIssuers.length === 0) return true;

    // Already verified this session
    if (this.verifiedPeers.has(peerNodeId)) return true;

    try {
      const infoRes = await fetch(`${baseUrl}/federation/v1/node-info`);
      if (!infoRes.ok) return false;

      const info = await infoRes.json() as NodeInfoResponse;

      if (!info.attestation) {
        // Peer has no attestation — allow but log
        console.log(`${this.label} Peer ${peerNodeId} has no attestation (unverified)`);
        this.verifiedPeers.add(peerNodeId);
        return true;
      }

      const trustedKeys = await this.loadTrustedKeys();
      if (trustedKeys.length === 0) {
        // No trusted keys available — allow but log
        console.log(`${this.label} No trusted issuer keys available, accepting ${peerNodeId}`);
        this.verifiedPeers.add(peerNodeId);
        return true;
      }

      const result = await verifyAttestation(info.attestation, trustedKeys);

      if (result.valid) {
        console.log(`${this.label} Peer ${peerNodeId} attestation verified (issuer: ${result.issuer})`);
        this.verifiedPeers.add(peerNodeId);
        return true;
      } else {
        console.log(`${this.label} Peer ${peerNodeId} attestation INVALID: ${result.error}`);
        return false;
      }
    } catch (err: any) {
      // Verification failed — don't sync but don't crash
      console.log(`${this.label} Failed to verify peer ${peerNodeId}: ${err.message}`);
      return false;
    }
  }

  private async syncAll() {
    for (const peer of this.config.peers) {
      try {
        const verified = await this.verifyPeer(peer.nodeId, peer.baseUrl);
        if (!verified) continue;

        await this.syncPeer(peer.nodeId, peer.baseUrl);
      } catch (err: any) {
        // Peer might not be up yet, that's fine
      }
    }
  }

  private async syncPeer(peerNodeId: string, baseUrl: string) {
    const peerRecord = this.db.prepare('SELECT lastSyncAt FROM peers WHERE nodeId = ?').get(peerNodeId) as { lastSyncAt: string | null } | undefined;
    const since = peerRecord?.lastSyncAt;

    let url = `${baseUrl}/federation/v1/listings`;
    if (since) url += `?since=${encodeURIComponent(since)}`;

    const res = await fetch(url);
    if (!res.ok) return;

    const data = (await res.json()) as FederationResponse;

    const upsert = this.db.prepare(`
      INSERT OR REPLACE INTO listings (
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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);

    let received = 0;
    for (const listing of data.listings) {
      upsert.run(
        listing.listingKey, listing.originNodeId, listing.listingId,
        listing.standardStatus, listing.visibility, listing.propertyType,
        listing.streetAddress, listing.city, listing.stateOrProvince,
        listing.postalCode, listing.listPrice,
        listing.bedroomsTotal, listing.bathroomsTotalInteger,
        listing.livingArea, listing.yearBuilt,
        listing.listAgentFullName, listing.listAgentLicense, listing.listAgentLicenseState,
        listing.listOfficeName, listing.listOfficeLicense, listing.listOfficeLicenseState,
        listing.photos ? JSON.stringify(listing.photos) : null,
        listing.latitude, listing.longitude,
        listing.closePrice, listing.closeDate, listing.originalListPrice,
        listing.concessionsAmount, listing.concessionsComments, listing.buyerFinancing,
        listing.buyerAgentFullName, listing.buyerAgentLicense, listing.buyerAgentLicenseState, listing.buyerOfficeName,
        listing.publicRemarks, listing.modificationTimestamp, listing.createdAt
      );
      received++;
    }

    // Update peer sync timestamp
    this.db.prepare('UPDATE peers SET lastSyncAt = ? WHERE nodeId = ?').run(data.timestamp, peerNodeId);

    // Log sync
    this.db.prepare('INSERT INTO sync_log (peerNodeId, syncedAt, listingsReceived, listingsRemoved) VALUES (?, ?, ?, ?)')
      .run(peerNodeId, new Date().toISOString(), received, 0);

    if (received > 0) {
      console.log(`${this.label} Synced from ${peerNodeId}: +${received}`);
    }
  }
}
