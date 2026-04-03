# PeerMLS

Open source, decentralized listing server. Each brokerage runs a node. Nodes federate with each other using RESO Web API standards. No central MLS. No middleman.

## Quick Start

```bash
yarn install
yarn start        # Spins up 3 federated nodes locally
yarn demo         # Runs the federation walkthrough (requires cluster running)
yarn import       # Import CLI (run with --help for usage)
```

## Verification

Nodes prove they are licensed brokerages before joining the network. A verification service checks the broker's license against state licensing databases and issues a signed attestation (JWT). Peers verify the attestation before accepting data.

Anyone can run a verification service. All attestations are logged to a public transparency log that anyone can audit. Multiple verifiers prevent any single entity from controlling network access. The default trusted issuer list is maintained in this repo via community review.

```bash
yarn verify               # Run a standalone verification service on :4000
```

The cluster demo (`yarn start`) automatically starts a verification service, verifies each node's license, and issues attestations before the nodes begin federating.

```
Verification Service (:4000)
  ├── POST /verify                 Submit license for verification
  ├── GET  /.well-known/jwks.json  Public signing keys
  ├── GET  /transparency-log       Auditable log of all attestations
  └── GET  /info                   Service metadata
```

## How It Works

Each node is a standalone server with its own SQLite database. Nodes peer with each other and sync listing data on an interval.

Brokers control visibility:
- **office** — listing stays on this node only
- **network** — listing federates to all peers automatically

Once a listing is set to `network` and synced by peers, they have it. Just like IDX replication — once it's out, it's out. Status updates (price changes, pending, closed) propagate on the next sync cycle.

The protocol is dumb pipes. It moves RESO-compliant data, validates schema, and that's it. No governance, no reputation scoring, no adjudication.

## Architecture

```
Node A (Alpha Realty)  <-->  Node B (Beta Brokers)
       \                      /
        \                    /
         Node C (Gamma Group)
```

Each node exposes:
- **Broker API** (`/api/v1/listings`) — CRUD for local listings
- **Federation API** (`/federation/v1/listings`) — peer sync endpoint
- **Health** (`/health`, `/peers`) — node status

Sync is pull-based. Each node polls its peers for new and updated listings. Single-origin ownership means only the creating node can edit a listing — peer copies are read-only replicas that update on the next sync cycle.

## API

### Broker API

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/v1/listings | List all listings (local + federated) |
| GET | /api/v1/listings/:key | Get single listing |
| POST | /api/v1/listings | Create listing |
| PATCH | /api/v1/listings/:key | Update listing |
| DELETE | /api/v1/listings/:key | Delete listing |

### Federation API

| Method | Path | Description |
|--------|------|-------------|
| GET | /federation/v1/listings | Network-visible listings (supports ?since=) |
| GET | /federation/v1/node-info | Node metadata |

### Create Listing

```bash
curl -X POST http://localhost:4001/api/v1/listings \
  -H "Content-Type: application/json" \
  -d '{
    "listingId": "MY-001",
    "streetAddress": "123 Main St",
    "city": "Austin",
    "stateOrProvince": "TX",
    "postalCode": "78701",
    "listPrice": 450000,
    "bedroomsTotal": 3,
    "bathroomsTotalInteger": 2,
    "livingArea": 1800,
    "yearBuilt": 2015,
    "listAgentFullName": "Jane Smith",
    "listOfficeName": "Smith Realty",
    "visibility": "network"
  }'
```

### Change Visibility

```bash
# Go network (federate to peers)
curl -X PATCH http://localhost:4001/api/v1/listings/{key} \
  -H "Content-Type: application/json" \
  -d '{"visibility": "network"}'

# Stop federating (peers keep their replicated copy)
curl -X PATCH http://localhost:4001/api/v1/listings/{key} \
  -H "Content-Type: application/json" \
  -d '{"visibility": "office"}'
```

## RESO Fields (Subset)

ListingKey, ListingId, StandardStatus, PropertyType, StreetAddress, City, StateOrProvince, PostalCode, ListPrice, BedroomsTotal, BathroomsTotalInteger, LivingArea, YearBuilt, ListAgentFullName, ListOfficeName, PublicRemarks, ModificationTimestamp

## Configuration

Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| NODE_ID | node-alpha | Unique node identifier |
| NODE_NAME | Alpha Realty | Display name |
| PORT | 4001 | HTTP port |
| DB_PATH | ./data/{NODE_ID}.db | SQLite database path |
| PEERS | (none) | Comma-separated peers: `id\|url,id\|url` |
| SYNC_INTERVAL_MS | 5000 | Sync poll interval |

## Import CLI

Import your brokerage's own listings from any MLS feed or CSV export. Supports all major MLS vendors.

### From RESO Web API

Supports any OData-compliant MLS data provider: Trestle, Bridge Interactive, Spark API, MLS Grid, and others.

```bash
# OAuth2 (Trestle, Paragon)
yarn import reso \
  --api-url https://your-provider.com/odata \
  --auth-type oauth2 \
  --token-url https://your-provider.com/oauth/token \
  --client-id YOUR_ID \
  --client-secret YOUR_SECRET \
  --office-field ListOfficeMlsId \
  --office-value MYOFFICE123

# Access token (Bridge Interactive)
yarn import reso \
  --api-url https://api.bridgedataoutput.com/api/v2/OData/yourmls \
  --auth-type access_token \
  --token YOUR_TOKEN \
  --office-field ListOfficeMlsId \
  --office-value MYOFFICE123

# Bearer token (Spark API, MLS Grid)
yarn import reso \
  --api-url https://your-provider.com/Reso/OData \
  --auth-type bearer \
  --token YOUR_TOKEN \
  --office-field ListOfficeMlsId \
  --office-value MYOFFICE123
```

The `--office-field` and `--office-value` filters pull only YOUR brokerage's listings. Common filter fields: `ListOfficeMlsId`, `ListOfficeKey`, `ListOfficeName`.

Use `--since` for incremental imports (only listings modified after a timestamp). Run it as a cron job to keep your node in sync during MLS transition.

### From CSV Export

Export your listings from any MLS portal as CSV, then import:

```bash
yarn import csv --file my-listings.csv --visibility network
```

The CSV importer auto-maps common column name variations (MLS #, Address, List Price, Beds, Baths, Sq Ft, etc.) to RESO fields. Use `--dry-run` to preview what would be imported.

### Options

| Flag | Default | Description |
|------|---------|-------------|
| --node-url | http://localhost:4001 | Target PeerMLS node |
| --visibility | network | office or network |
| --page-size | 200 | OData page size |
| --rps | 2 | Rate limit (requests/second) |
| --since | (none) | Incremental: only after this ISO timestamp |
| --dry-run | false | Preview without sending |

## Integration Guide

Most brokerages already have RESO-compliant data flowing through their existing systems. PeerMLS speaks the same language. Here's how existing tools connect.

### Migrating from an MLS (IDX/RETS Feed)

Your MLS already gives you a RESO Web API or RETS feed. That same data export drops straight into your node.

```bash
# Export your listings from the MLS feed (you already have this data)
# Then POST each one to your node

curl -X POST http://localhost:4001/api/v1/listings \
  -H "Content-Type: application/json" \
  -d '{
    "listingId": "MLS-12345",
    "streetAddress": "100 Congress Ave",
    "city": "Austin",
    "stateOrProvince": "TX",
    "postalCode": "78701",
    "listPrice": 525000,
    "bedroomsTotal": 3,
    "bathroomsTotalInteger": 2,
    "livingArea": 2100,
    "yearBuilt": 2018,
    "listAgentFullName": "Jane Smith",
    "listOfficeName": "Smith Realty",
    "visibility": "network"
  }'
```

A simple cron script reads from your existing RETS/RESO feed and writes to your node. Field names are the same RESO Data Dictionary fields you already use. No mapping, no translation.

```javascript
// Example: sync from existing RESO Web API feed to your PeerMLS node
async function syncFromMLS(resoFeedUrl, peermlsUrl) {
  const listings = await fetch(resoFeedUrl).then(r => r.json());

  for (const listing of listings.value) {
    await fetch(`${peermlsUrl}/api/v1/listings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        listingId: listing.ListingId,
        standardStatus: listing.StandardStatus,
        streetAddress: listing.UnparsedAddress,
        city: listing.City,
        stateOrProvince: listing.StateOrProvince,
        postalCode: listing.PostalCode,
        listPrice: listing.ListPrice,
        bedroomsTotal: listing.BedroomsTotal,
        bathroomsTotalInteger: listing.BathroomsTotalInteger,
        livingArea: listing.LivingArea,
        yearBuilt: listing.YearBuilt,
        listAgentFullName: listing.ListAgentFullName,
        listOfficeName: listing.ListOfficeName,
        publicRemarks: listing.PublicRemarks,
        visibility: 'network'
      })
    });
  }
}
```

### Back Office / Transaction Management

Your back office system already pushes listing data somewhere. Point it at your node instead of (or in addition to) the MLS.

Most back office platforms support webhook or API integrations:

1. **On new listing**: POST to your node's `/api/v1/listings`
2. **On status change**: PATCH to update `standardStatus` (Active, Pending, Closed)
3. **On price change**: PATCH to update `listPrice`

Your node handles federation. The back office doesn't need to know about peers.

### CRM Integration

Your CRM can read from your node the same way it reads from IDX today. The `/api/v1/listings` endpoint returns RESO-standard JSON.

```bash
# Your CRM polls for all network listings across the federation
curl http://localhost:4001/api/v1/listings

# Filter by status
curl http://localhost:4001/api/v1/listings?status=Active

# Filter by origin (just your brokerage's listings)
curl http://localhost:4001/api/v1/listings?originNodeId=node-alpha
```

### Consumer Websites

Any IDX website that can consume a JSON API can consume your node. Replace the MLS IDX feed URL with your node's API.

```javascript
// Your existing IDX site already does something like this.
// Just change the URL.
const listings = await fetch('http://your-node.example.com/api/v1/listings?status=Active')
  .then(r => r.json());
```

Because every node in the network syncs listings from its peers, querying your single node returns listings from the entire federation. Same experience as IDX, no MLS required.

### Portal Syndication

Portals currently pull from MLS feeds. A PeerMLS node exposes the same RESO-standard data. Portals can pull from any node's federation endpoint:

```
GET /federation/v1/listings
```

Returns the same RESO fields portals already ingest. A portal aggregator would subscribe to multiple nodes the same way it currently subscribes to multiple MLSs, except the feed is open and free instead of licensed.

### Hosting for Small Brokerages

If you're a large brokerage running a node, you can host smaller shops. They get a login to enter listings through your API. Their listings are tagged with their own `listOfficeName` and `listAgentFullName`. They don't run any infrastructure.

From the small brokerage's perspective, it's a web form that publishes to the network. If they outgrow you or want to switch hosts, they export their listings (GET all where `listOfficeName` matches) and import to a new node. The data is theirs. Zero lock-in.

### Running Alongside the MLS

You don't have to leave the MLS to run a node. Many brokerages will run both during transition:

1. Listings go into the MLS per current requirements
2. Same listings go into your PeerMLS node
3. Your node federates with other nodes in the network
4. Over time, as the network grows, the MLS becomes redundant

The cost of running a node alongside the MLS is near zero. A $5/month VPS handles it. You're just adding a second destination for data you already produce.

### Sold/Closed Data

Brokers enter their own closed transactions the same way they enter active listings. The closing price, concessions, financing terms, buyer agent info — all of it is first-party data the listing broker originated. The MLS was just the form they typed it into.

```bash
curl -X POST http://localhost:4001/api/v1/listings \
  -H "Content-Type: application/json" \
  -d '{
    "listingId": "CLOSED-042",
    "standardStatus": "Closed",
    "streetAddress": "200 Barton Springs Rd",
    "city": "Austin",
    "stateOrProvince": "TX",
    "postalCode": "78704",
    "listPrice": 475000,
    "bedroomsTotal": 3,
    "bathroomsTotalInteger": 2,
    "livingArea": 1950,
    "yearBuilt": 2010,
    "listAgentFullName": "Jane Smith",
    "listOfficeName": "Smith Realty",
    "publicRemarks": "Sold at $460,000. Seller paid $8,000 in concessions.",
    "visibility": "network"
  }'
```

Once federated, every peer node has sold comps from across the network. Appraisers and lenders get the same structured data they currently pull from the MLS — except it came directly from the brokers who closed the deals.

County public records can serve as an additional verification layer. When a closing posts to the county recorder (typically 30-90 days after close), nodes can cross-reference the broker-reported price against the public record. This is better than what the MLS does today, which is nothing.

## License

MIT
