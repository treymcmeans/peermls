CREATE TABLE IF NOT EXISTS listings (
  listingKey            TEXT PRIMARY KEY,
  originNodeId          TEXT NOT NULL,
  listingId             TEXT NOT NULL,
  standardStatus        TEXT NOT NULL DEFAULT 'Active',
  visibility            TEXT NOT NULL DEFAULT 'office',
  propertyType          TEXT NOT NULL DEFAULT 'Residential',
  streetAddress         TEXT,
  city                  TEXT,
  stateOrProvince       TEXT,
  postalCode            TEXT,
  listPrice             REAL,
  bedroomsTotal         INTEGER,
  bathroomsTotalInteger INTEGER,
  livingArea            REAL,
  yearBuilt             INTEGER,
  listAgentFullName     TEXT,
  listAgentLicense      TEXT,
  listAgentLicenseState TEXT,
  listOfficeName        TEXT,
  listOfficeLicense     TEXT,
  listOfficeLicenseState TEXT,
  photos                TEXT,
  latitude              REAL,
  longitude             REAL,
  closePrice            REAL,
  closeDate             TEXT,
  originalListPrice     REAL,
  concessionsAmount     REAL,
  concessionsComments   TEXT,
  buyerFinancing        TEXT,
  buyerAgentFullName    TEXT,
  buyerAgentLicense     TEXT,
  buyerAgentLicenseState TEXT,
  buyerOfficeName       TEXT,
  publicRemarks         TEXT,
  modificationTimestamp TEXT NOT NULL,
  createdAt             TEXT NOT NULL DEFAULT (datetime('now')),
  isFederated           INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_listings_origin ON listings(originNodeId);
CREATE INDEX IF NOT EXISTS idx_listings_visibility ON listings(visibility);
CREATE INDEX IF NOT EXISTS idx_listings_modified ON listings(modificationTimestamp);
CREATE INDEX IF NOT EXISTS idx_listings_agent_license ON listings(listAgentLicense);

CREATE TABLE IF NOT EXISTS flags (
  id                TEXT PRIMARY KEY,
  listingKey        TEXT NOT NULL,
  field             TEXT NOT NULL,
  reason            TEXT NOT NULL,
  flaggedBy         TEXT NOT NULL,
  flaggedByAgent    TEXT,
  flaggedByLicense  TEXT,
  status            TEXT NOT NULL DEFAULT 'open',
  resolution        TEXT,
  resolvedAt        TEXT,
  timestamp         TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (listingKey) REFERENCES listings(listingKey)
);

CREATE INDEX IF NOT EXISTS idx_flags_listing ON flags(listingKey);

CREATE TABLE IF NOT EXISTS peers (
  nodeId     TEXT PRIMARY KEY,
  baseUrl    TEXT NOT NULL,
  lastSyncAt TEXT
);

CREATE TABLE IF NOT EXISTS sync_log (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  peerNodeId       TEXT NOT NULL,
  syncedAt         TEXT NOT NULL,
  listingsReceived INTEGER DEFAULT 0,
  listingsRemoved  INTEGER DEFAULT 0
);
