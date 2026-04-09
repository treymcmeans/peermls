# PeerMLS Protocol Spec

Version: 0.1.0 (Draft)

## Overview

PeerMLS is a federation protocol for real estate listing data. Each participating brokerage runs a node. Nodes sync listing data with each other using RESO Web API standards over HTTPS. The protocol handles data transfer, schema validation, and node identity. It does not handle governance, reputation, or dispute resolution.

## Node Identity

A node can be operated by a brokerage or an individual agent. Both hold state-issued licenses. The network does not distinguish between them at the protocol level — a verified license is a verified license.

Every node has:
- **nodeId**: unique identifier (typically a domain, e.g., `smithrealty.com` or `janesmith-agent.com`)
- **license**: state license number and state of licensure
- **licenseType**: `broker` or `agent`
- **publicKey**: the node's public signing key
- **attestation**: a signed JWT from a trusted verification service binding the nodeId to the verified license

### Attestation Format

A JWT signed by a verification service with the following claims:

```json
{
  "sub": "smithrealty.com",
  "license": "GA-H12345",
  "state": "GA",
  "name": "Smith Realty",
  "licenseType": "broker",
  "status": "active",
  "iat": 1712188800,
  "exp": 1719964800,
  "iss": "https://verify.peermls.org"
}
```

Attestations expire after 90 days. Nodes must re-verify to continue federating. If a license is revoked or suspended by the state, the attestation naturally expires and cannot be renewed.

### Verification Service Requirements

A verification service:
1. Checks license status against state licensing databases (both broker and agent licenses)
2. Issues signed JWTs binding a nodeId to a verified license
3. Publishes its public key at `/.well-known/jwks.json`
4. Logs every issued attestation to a public transparency log

Multiple verification services can operate independently. Each node and peer decides which issuers to trust via a `trustedIssuers` configuration.

### Transparency Log

All license attestations are logged in a public, append-only Merkle tree (Certificate Transparency model). This ensures:
- Every attestation is auditable by anyone
- Attestations cannot be silently added, modified, or removed
- If a verifier issues a bad attestation, it is permanently visible

## Security Architecture

PeerMLS uses a three-layer security model. Layer 1 is implemented in the reference implementation. Layers 2 and 3 are specified for production deployments.

### Layer 1: Node Identity (JWT Attestation) — Implemented

The verification service issues a JWT after confirming the node operator's license against state databases. The JWT proves "this node is a verified participant in PeerMLS." Peers verify the JWT signature against trusted issuers' JWKS endpoints before accepting federation data.

**API key authentication.** Write endpoints (POST, PATCH, DELETE on `/api/`) require an API key via the `X-API-Key` header. Read endpoints and federation endpoints remain open. Each node generates its own API key at setup.

**Attestation verification during sync.** Before syncing from a peer, the sync engine fetches the peer's `node-info`, extracts the attestation JWT, and verifies its signature against the trusted issuers' public keys. If verification fails, the sync is skipped. Verified peers are cached for the session.

### Layer 2: Request Authentication (HTTP Message Signatures) — Specified, Not Yet Implemented

Each node generates an Ed25519 keypair at enrollment. The public key is registered with the verification service and published in the node's profile. Every federation request is signed per RFC 9421 (HTTP Message Signatures), covering the method, path, body digest, and timestamp.

This solves the bearer token problem: even if someone steals a JWT, they cannot forge signed requests without the private key. It also provides replay protection (via timestamp) and request integrity (body is bound to the signature).

### Layer 3: Signed Listing Records — Specified, Not Yet Implemented

Each listing record is signed by the originating node's Ed25519 key. The signature travels with the data through federation. Any node that receives a listing — whether directly or through an aggregator — can verify it was created by the claimed origin. A compromised intermediary cannot inject or modify listings.

This provides non-repudiation: if a node publishes a listing, the signature is permanent proof.

### Why These Three Layers

- **Layer 1 (JWT)** answers: is this node a verified participant?
- **Layer 2 (HTTP Signatures)** answers: did this request actually come from that node?
- **Layer 3 (Record Signing)** answers: did this data originate from who it claims?

Each layer addresses a different attack vector. JWT alone is vulnerable to token theft. HTTP signatures without record signing are vulnerable to intermediary tampering. All three together provide defense in depth.

## Peering

Peering is bilateral. Node A decides to peer with Node B, and Node B decides to peer with Node A. Neither is forced. The protocol does not mandate peering with any node.

When Node A wants to peer with Node B:
1. Node A presents its attestation JWT
2. Node B verifies the JWT signature against its `trustedIssuers` list
3. If valid, Node B accepts the peering request
4. Sync begins

## Sync Protocol

Sync is pull-based. Each node polls its peers on a configurable interval.

### Federation Endpoint

```
GET /federation/v1/listings?since={ISO8601}
```

Returns all listings with `visibility = network` from the originating node, modified after the `since` timestamp. Omitting `since` returns all network-visible listings.

Response:

```json
{
  "nodeId": "smithrealty.com",
  "nodeName": "Smith Realty",
  "timestamp": "2026-04-04T12:00:00Z",
  "listings": [...]
}
```

### Replication Model

Once a listing is synced to a peer, the peer has it. There is no retraction mechanism. This matches how IDX replication works today. Status updates (price changes, pending, closed) propagate on the next sync cycle via `ModificationTimestamp` ordering.

Peers store synced listings as read-only replicas (`isFederated = 1`). Only the originating node can modify a listing.

### Conflict Resolution

Last-write-wins by `ModificationTimestamp`. Since only the originating node can modify a listing, true conflicts cannot occur. The `ModificationTimestamp` ordering is for sync consistency only.

## Listing Schema

Listings use a subset of the RESO Data Dictionary. All field names follow RESO naming conventions.

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| listingKey | string | Globally unique identifier (UUID) |
| listingId | string | Broker-assigned listing number |
| standardStatus | enum | Active, Pending, Closed, Withdrawn, Expired, ComingSoon |
| visibility | enum | office, network |
| originNodeId | string | Node that created the listing |
| modificationTimestamp | ISO8601 | Last modification time |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| propertyType | enum | Residential, Commercial, Land, MultiFamily |
| streetAddress | string | Street address |
| city | string | City |
| stateOrProvince | string | Two-letter state code |
| postalCode | string | ZIP code |
| listPrice | number | List price in dollars |
| bedroomsTotal | integer | Total bedrooms |
| bathroomsTotalInteger | integer | Total bathrooms |
| livingArea | number | Living area in square feet |
| yearBuilt | integer | Year built |
| listAgentFullName | string | Listing agent name |
| listAgentLicense | string | Agent state license number |
| listAgentLicenseState | string | Agent license state (two-letter) |
| listOfficeName | string | Listing office name |
| listOfficeLicense | string | Brokerage license number |
| listOfficeLicenseState | string | Brokerage license state (two-letter) |
| publicRemarks | string | Public description |

### Field-Level Visibility (Tentative)

> **Status: Under consideration.** This section describes a proposed field-level visibility model. It is not yet implemented in the reference implementation and is subject to change based on industry feedback.

Not all listing data should be equally accessible. The MLS bundled data access into a single gate — you're in or you're out. PeerMLS can separate what the public sees from what licensed professionals see, while giving the listing broker control.

#### Three Tiers

**Public** — visible to anyone, including consumers, portals, and unauthenticated API requests.

| Field | Tier |
|-------|------|
| streetAddress, city, stateOrProvince, postalCode | public |
| listPrice, bedroomsTotal, bathroomsTotalInteger, livingArea, yearBuilt | public |
| propertyType, standardStatus | public |
| publicRemarks | public |
| listOfficeName | public |

**Network** — visible only to verified nodes (valid attestation). Not served to unauthenticated consumers.

| Field | Tier |
|-------|------|
| buyerBrokerCompensation | network |
| listAgentFullName, listAgentLicense, listAgentLicenseState | network |
| listAgentPhone, listAgentEmail | network |
| showingInstructions | network |
| privateRemarks | network |
| concessions (on closed listings) | network |

**Office** — never federates. Stays on the originating node only.

| Field | Tier |
|-------|------|
| sellerMotivation | office |
| lockboxCode | office |
| internalNotes | office |
| ownerContact | office |

#### How It Works

The federation endpoint serves fields based on the requesting node's trust level:
- **Unauthenticated request** → public fields only
- **Request with valid attestation** → public + network fields
- **Local query on originating node** → all fields (public + network + office)

Aggregator nodes serving consumer-facing applications strip network-tier fields automatically. Aggregator nodes serving verified agent CRMs include them.

#### Broker Override

The spec defines default tiers for each field, but the listing broker can override on a per-listing basis. A broker who wants to make compensation public can promote it. A broker who wants to keep agent contact info off the network feed can restrict it. The defaults set the norm; the broker has the final say.

#### Buyer Broker Compensation (Tentative)

> **Status: Under consideration.** Compensation transparency is a sensitive topic post-NAR settlement. This field is proposed but requires industry input on defaults and disclosure requirements.

```json
{
  "buyerBrokerCompensation": {
    "type": "percentage",
    "value": 2.5,
    "description": "2.5% of closing price to cooperating buyer's broker",
    "effectiveDate": "2026-04-04T00:00:00Z"
  }
}
```

Because PeerMLS replicates listing data to peers with timestamps, compensation offers create a natural audit trail. If a broker sets compensation at 2.5% and later changes it to 2%, every peer already has the original value with its timestamp. The listing broker cannot claim "I never offered that" when the network has distributed, timestamped proof.

This provides the system of record that currently does not exist post-NAR settlement, without requiring a central authority to maintain it.

### Data Accuracy Flags

Any verified node can flag a listing for inaccurate data. A flag is not a punishment or a score. It is a notification to the originating broker that another licensed professional believes a field is wrong.

#### Flag Format

```json
{
  "listingKey": "abc-123",
  "field": "livingArea",
  "reason": "Tax records show 1,850 sqft, listing says 2,200",
  "flaggedBy": "node-beta",
  "flaggedByAgent": "Jane Smith",
  "flaggedByLicense": "GA-SA44444",
  "timestamp": "2026-04-05T14:30:00Z"
}
```

#### How It Works

1. An agent on any node sees inaccurate data on a federated listing
2. They submit a flag through their node's API: `POST /api/v1/listings/:key/flags`
3. The flag is stored on the flagging node and delivered to the originating node on the next sync
4. The originating broker receives the flag as a notification
5. They fix the data or leave it. Their choice.
6. Flags are visible to any node that queries the listing

Flags are data, not governance. The protocol does not penalize, suspend, or deprioritize listings with flags. It surfaces the information and lets the market decide what to do with it. A listing with zero flags and a listing with five flags are treated identically by the sync protocol. But any agent or tool querying that listing can see the flags and factor them into their own judgment.

This is better than what the MLS does today. In the MLS, an agent reports inaccurate data to a compliance department. Maybe they send a letter. Maybe they fine the agent weeks later. The reporting agent never knows the outcome. In PeerMLS, the flag is immediate, visible, and tied to a verified license. The originating broker knows exactly who flagged it and why.

### Schema Extension

Additional RESO Data Dictionary fields can be included. Nodes must ignore fields they do not recognize. The protocol validates required fields and passes through everything else.

## Node Info Endpoint

```
GET /federation/v1/node-info
```

Returns:

```json
{
  "nodeId": "smithrealty.com",
  "nodeName": "Smith Realty",
  "totalListings": 142,
  "networkListings": 138,
  "license": {
    "number": "GA-H12345",
    "state": "GA"
  },
  "attestation": "eyJhbGciOi..."
}
```

## Health Endpoint

```
GET /health
```

Returns node status, local and federated listing counts, and peer list.

## Open Ecosystem

The MLS bundled listings, showings, lockboxes, compensation, compliance, and vendor access into one system. Vendors who wanted to build tools needed MLS board approval, data licensing agreements, and years-long procurement cycles. The MLS controlled the data, which meant it controlled who could build on top of it.

PeerMLS unbundles this. The protocol handles listing data. Everything else is a tool that reads from and writes to the open network. If you can call an API, you can build on PeerMLS. No vendor agreement. No board approval. No procurement cycle.

### Vendor Authorization

The network does not approve vendors. There is no central vendor registry, no board approval, no procurement process. Each brokerage decides which tools can access their node. The brokerage authorizes the vendor, not the network.

PeerMLS uses OAuth2 for vendor authorization, following the model established by the AT Protocol (Bluesky). Each node runs its own OAuth2 authorization server. Vendors discover the node's auth endpoint, request scoped access, and the brokerage grants or denies.

#### How It Works

**1. Vendor identifies itself.** The vendor hosts a client metadata document at a stable URL describing their application:

```
GET https://showingapp.com/.well-known/peermls-client.json

{
  "client_id": "https://showingapp.com/.well-known/peermls-client.json",
  "client_name": "ShowingApp",
  "redirect_uris": ["https://showingapp.com/callback"],
  "scope": "listings:read showings:write",
  "client_uri": "https://showingapp.com",
  "contacts": ["support@showingapp.com"]
}
```

The vendor's identity is their URL. Any node can verify the vendor by fetching this document. No pre-registration needed.

**2. Node publishes its auth endpoint.** Each node exposes OAuth2 metadata at a well-known URL:

```
GET https://node.smithrealty.com/.well-known/oauth-authorization-server

{
  "issuer": "https://node.smithrealty.com",
  "authorization_endpoint": "https://node.smithrealty.com/oauth/authorize",
  "token_endpoint": "https://node.smithrealty.com/oauth/token",
  "scopes_supported": ["listings:read", "listings:write", "network:read", "flags:write"]
}
```

**3. Brokerage grants access.** The vendor's app redirects the brokerage user to their node's consent screen. The screen shows which scopes the app is requesting. The brokerage approves or denies. On approval, the app receives a scoped access token.

**4. Token works against that node.** The vendor uses the token to call the brokerage's API with only the permissions granted. The vendor repeats this flow for each brokerage they serve. Same integration pattern, different node.

#### Scopes

| Scope | Description |
|-------|-------------|
| `listings:read` | Read active and sold listings (public-tier fields) |
| `listings:write` | Create and update listings |
| `network:read` | Read network-tier fields (compensation, agent contact, private remarks) |
| `flags:read` | Read data accuracy flags |
| `flags:write` | Flag listings for inaccurate data |
| `stats:read` | Read node and network statistics |

Brokerages configure which scopes they will grant to which vendors. A CMA tool might get `listings:read` and `stats:read`. A transaction manager might get `listings:read` and `listings:write`. A showing coordinator might get `listings:read` and `network:read`.

#### No Central Vendor Registry Required

Any vendor can build on PeerMLS by hosting a client metadata document and running the OAuth flow against any node. No permission from PeerMLS, the foundation, or any other brokerage is needed. The vendor needs permission only from the brokerages they serve.

This follows the email model. Gmail does not approve which apps can connect to your inbox. You authorize apps yourself. PeerMLS works the same way.

#### Optional Vendor Directory

PeerMLS may operate an open vendor directory where vendors publish their client metadata URL and verify their domain. The directory attests identity ("this is really ShowingApp at showingapp.com"), not quality. Any vendor can list themselves. Brokerages can configure their node to auto-trust directory-listed vendors or require manual approval for unlisted ones. The directory is a convenience, not a requirement.

#### Current Implementation

The reference implementation uses API key authentication (`X-API-Key` header) as a simplified version of this model. The full OAuth2 flow described above is the target for production deployments. The API key model works identically in terms of access control — writes require a key, reads are open — without the multi-node discovery and consent flow.

### How Tools Connect

Any tool can interact with the network at three levels:

**Read from any node or aggregator** — public listing data is open. A showing scheduler, CMA tool, or consumer app queries the API the same way any other client does. No authentication required for public-tier fields.

**Read network-tier data with authorization** — tools that serve verified agents request the `network:read` scope via OAuth. The brokerage grants access. The tool receives network-visible fields (compensation, agent contact info, private remarks).

**Write through a brokerage node** — tools that create or update listings request the `listings:write` scope via OAuth. The brokerage grants access. The tool operates on behalf of the brokerage with only the permissions granted.

### Tools the Network Enables

The following categories are not built into PeerMLS. They are independent tools and services that anyone can build on top of the open protocol.

**Showing coordination.** A showing scheduler reads listing data (address, status, showing instructions) from the network and coordinates between buyer's agents and listing agents. Smart lock integrations read listing status — when a listing goes pending or closed, access is automatically revoked. No single vendor controls showing access because no single vendor controls the data.

**Comparative market analysis.** CMA tools pull active and sold listings from any aggregator node. Sold data includes broker-reported closing prices, concessions, and financing terms. County records integration provides independent verification. No MLS data license required.

**Offer management.** An offer platform reads listing details from the network, lets buyer's agents submit offers, and delivers them to the listing agent's node. The listing agent reviews offers in whatever tool they prefer. The protocol doesn't prescribe offer format — it provides the listing data that offer tools need to function.

**Transaction management.** A transaction platform listens for status changes on a brokerage's listings (active to pending, pending to closed) and triggers workflows — title orders, inspection scheduling, appraisal requests, closing coordination. Status changes propagate through the network on each sync cycle.

**Marketing automation.** A marketing tool subscribes to new listings from a brokerage's node and auto-generates social posts, email campaigns, print materials, and portal syndication. The tool reads listing data and photos from the API. The brokerage doesn't need to manually enter listing info in multiple systems.

**AI agents.** An AI assistant reads listing data from the network, answers buyer questions, coordinates showings, drafts offer terms, and manages transaction timelines. The AI operates on the same open data any other tool uses. No special access required.

**Consumer search.** Anyone can build a consumer-facing property search portal that reads from an aggregator node. The public tier of listing data — address, price, beds, baths, photos, remarks — is available without authentication. Consumer portals compete on product quality and user experience, not on who has a data licensing deal.

**Appraisal and lending.** Appraisal tools and lender platforms pull sold comps from the network. Each sold record traces to a verified broker with a license number. County records cross-referencing provides an independent accuracy check. The data provenance chain (broker attestation, license verification, county confirmation) gives underwriters a defensible source.

### The Principle

PeerMLS does not build tools. It provides the open data layer that tools need to exist. Competition happens on product quality, not data access. The best showing scheduler wins because it is the best showing scheduler, not because it has an exclusive MLS integration. The best CMA tool wins because its analysis is better, not because it is the only one with comp data.

This is the same dynamic that made the web work. HTTP didn't build browsers, search engines, or e-commerce platforms. It provided the open protocol they all run on. The tools came because the data was open.

## State-by-State Compliance

Every previous attempt at a national MLS failed because it tried to reconcile 50 different sets of state laws into one system. Different disclosure requirements, different licensing frameworks, different property transfer rules. One committee, 50 arguments, no progress.

PeerMLS does not have this problem because the protocol does not make compliance decisions. Each node operates under its own state's laws. The protocol moves data. State compliance is the broker's responsibility.

### How It Works in Practice

**Seller disclosure.** California requires extensive disclosure — natural hazard zones, earthquake faults, death on the property, Mello-Roos tax districts. The Transfer Disclosure Statement alone has over 100 fields. Alabama is a caveat emptor state with no statutory disclosure form.

A California broker's node includes `naturalHazardZone`, `earthquakeFaultZone`, `deathOnProperty`, `melloRoosDistrict` on their listings. An Alabama broker's node includes none of those. Both nodes federate with each other. The schema extension rule handles this: "nodes must ignore fields they do not recognize." California adds 100 fields. Alabama adds zero. Texas adds its own. The protocol doesn't break.

A centralized national MLS would need to decide: 100 California fields or zero Alabama fields? PeerMLS doesn't decide. Each state uses whatever fields it needs.

**Public marketing requirements.** Washington SB 6091 requires that if a listing is marketed to anyone, it must be marketed to everyone. A Washington broker's node defaults all listings to `visibility: network` because state law requires it. An Alabama broker has no such mandate and can use `office` visibility freely. Both are on the same network, following different state laws. The protocol is indifferent because visibility is a per-listing, per-broker decision.

**License types.** Some states distinguish between brokers, associate brokers, and salespersons. Some have provisional licenses, temporary licenses, or team licenses. The verification service checks whatever the state database returns. The protocol stores the license number and state. It does not interpret license types or enforce state-specific license rules.

### The Principle

The protocol is deliberately ignorant of state law. It defines a data format and a sync mechanism. Everything else — what fields to include, when to make listings public, what disclosures to attach, how to handle compensation — is decided by the broker operating under their state's requirements. This is why PeerMLS can operate nationally without a national regulatory framework. The regulatory framework already exists. It's called state law.

## Interoperability

Any implementation that:
1. Serves the federation endpoint in the specified format
2. Accepts and stores listings from peers via the sync protocol
3. Validates required fields per the listing schema
4. Presents a valid attestation when peering

is a valid PeerMLS node. The reference implementation in this repository is one such implementation. Others are encouraged.
