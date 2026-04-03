import { ResoClient } from './reso-client.js';
import { readCSV } from './csv-reader.js';
import { transformToPeerMLS } from './transform.js';
import { AuthConfig, ResoProperty } from './types.js';

const HELP = `
PeerMLS Import CLI

Import your brokerage's listings from MLS feeds or CSV exports into your PeerMLS node.

Usage:
  peermls-import reso   [options]    Import from RESO Web API / OData feed
  peermls-import csv    [options]    Import from CSV export

RESO Import:
  --api-url <url>              MLS vendor API base URL (e.g., https://api.trestle.com/odata)
  --auth-type <type>           Auth type: bearer | oauth2 | access_token
  --token <token>              Bearer token or access token
  --token-url <url>            OAuth2 token endpoint
  --client-id <id>             OAuth2 client ID
  --client-secret <secret>     OAuth2 client secret
  --scope <scope>              OAuth2 scope (optional)
  --office-field <field>       RESO field to filter by (default: ListOfficeMlsId)
  --office-value <value>       Your brokerage's office ID
  --since <timestamp>          Only import listings modified after this ISO timestamp
  --page-size <n>              OData page size (default: 200)
  --rps <n>                    Rate limit, requests per second (default: 2)

CSV Import:
  --file <path>                Path to CSV file

Common:
  --node-url <url>             Target PeerMLS node (default: http://localhost:4001)
  --visibility <v>             Visibility for imported listings: office | network (default: network)
  --dry-run                    Print what would be imported without sending

Examples:

  # Trestle (CoreLogic) - OAuth2
  peermls-import reso \\
    --api-url https://api.trestle.com/odata \\
    --auth-type oauth2 \\
    --token-url https://api.trestle.com/oauth/token \\
    --client-id YOUR_ID \\
    --client-secret YOUR_SECRET \\
    --office-field ListOfficeMlsId \\
    --office-value MYOFFICE123

  # Bridge Interactive (FMLS, ValleyMLS) - access token
  peermls-import reso \\
    --api-url https://api.bridgedataoutput.com/api/v2/OData/fmls \\
    --auth-type access_token \\
    --token YOUR_TOKEN \\
    --office-field ListOfficeMlsId \\
    --office-value MYOFFICE123

  # Spark API (East TN, others) - bearer token
  peermls-import reso \\
    --api-url https://replication.sparkapi.com/Reso/OData \\
    --auth-type bearer \\
    --token YOUR_TOKEN \\
    --office-field ListOfficeMlsId \\
    --office-value MYOFFICE123

  # MLS Grid - bearer token
  peermls-import reso \\
    --api-url https://api.mlsgrid.com/v2 \\
    --auth-type bearer \\
    --token YOUR_TOKEN \\
    --office-field ListOfficeMlsId \\
    --office-value MYOFFICE123

  # CSV export from MLS portal
  peermls-import csv --file my-listings.csv --visibility network

  # Dry run (see what would be imported)
  peermls-import csv --file my-listings.csv --dry-run
`;

function parseArgs(args: string[]) {
  const parsed: Record<string, string> = {};
  const flags: Set<string> = new Set();

  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
        parsed[key] = args[i + 1];
        i++;
      } else {
        flags.add(key);
      }
    }
  }

  return { parsed, flags };
}

async function postToNode(nodeUrl: string, listing: any, dryRun: boolean): Promise<boolean> {
  if (dryRun) return true;

  try {
    const res = await fetch(`${nodeUrl}/api/v1/listings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(listing),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`  Failed to import ${listing.listingId}: ${res.status} ${body}`);
      return false;
    }
    return true;
  } catch (err: any) {
    console.error(`  Failed to import ${listing.listingId}: ${err.message}`);
    return false;
  }
}

async function importReso(args: string[]) {
  const { parsed, flags } = parseArgs(args);
  const dryRun = flags.has('dry-run');

  const apiUrl = parsed['api-url'];
  const authType = parsed['auth-type'] as 'bearer' | 'oauth2' | 'access_token';
  if (!apiUrl || !authType) {
    console.error('Missing required: --api-url, --auth-type');
    process.exit(1);
  }

  let auth: AuthConfig;
  if (authType === 'oauth2') {
    auth = {
      type: 'oauth2',
      tokenUrl: parsed['token-url'] || '',
      clientId: parsed['client-id'] || '',
      clientSecret: parsed['client-secret'] || '',
      scope: parsed['scope'],
    };
  } else {
    auth = { type: authType, token: parsed['token'] || '' };
  }

  const officeField = parsed['office-field'] || 'ListOfficeMlsId';
  const officeValue = parsed['office-value'];
  if (!officeValue) {
    console.error('Missing required: --office-value');
    process.exit(1);
  }

  const nodeUrl = parsed['node-url'] || 'http://localhost:4001';
  const visibility = (parsed['visibility'] || 'network') as 'office' | 'network';
  const pageSize = parseInt(parsed['page-size'] || '200', 10);
  const rps = parseInt(parsed['rps'] || '2', 10);
  const since = parsed['since'];

  console.log(`\nPeerMLS RESO Import`);
  console.log(`  API: ${apiUrl}`);
  console.log(`  Auth: ${authType}`);
  console.log(`  Office: ${officeField} = ${officeValue}`);
  console.log(`  Target: ${nodeUrl}`);
  console.log(`  Visibility: ${visibility}`);
  if (since) console.log(`  Since: ${since}`);
  if (dryRun) console.log(`  DRY RUN (no data will be sent)`);
  console.log('');

  const client = new ResoClient(apiUrl, auth, rps);
  let imported = 0;
  let failed = 0;

  const total = await client.fetchAll(
    { field: officeField, value: officeValue },
    { pageSize, since },
    async (batch: ResoProperty[], page: number) => {
      console.log(`  Page ${page + 1}: ${batch.length} listings`);

      for (const prop of batch) {
        const listing = transformToPeerMLS(prop, visibility);

        if (dryRun) {
          console.log(`    [dry-run] ${listing.listingId} | ${listing.streetAddress} | $${listing.listPrice} | ${listing.standardStatus}`);
          imported++;
          continue;
        }

        const ok = await postToNode(nodeUrl, listing, false);
        if (ok) imported++;
        else failed++;
      }
    }
  );

  console.log(`\nDone. ${imported} imported, ${failed} failed (${total} total from feed).`);
}

async function importCSV(args: string[]) {
  const { parsed, flags } = parseArgs(args);
  const dryRun = flags.has('dry-run');
  const filePath = parsed['file'];

  if (!filePath) {
    console.error('Missing required: --file');
    process.exit(1);
  }

  const nodeUrl = parsed['node-url'] || 'http://localhost:4001';
  const visibility = (parsed['visibility'] || 'network') as 'office' | 'network';

  console.log(`\nPeerMLS CSV Import`);
  console.log(`  File: ${filePath}`);
  console.log(`  Target: ${nodeUrl}`);
  console.log(`  Visibility: ${visibility}`);
  if (dryRun) console.log(`  DRY RUN (no data will be sent)`);
  console.log('');

  const properties = readCSV(filePath);
  console.log(`  Parsed ${properties.length} listings from CSV\n`);

  let imported = 0;
  let failed = 0;

  for (const prop of properties) {
    const listing = transformToPeerMLS(prop, visibility);

    if (dryRun) {
      console.log(`  [dry-run] ${listing.listingId} | ${listing.streetAddress} | $${listing.listPrice} | ${listing.standardStatus}`);
      imported++;
      continue;
    }

    const ok = await postToNode(nodeUrl, listing, false);
    if (ok) {
      imported++;
      if (imported % 50 === 0) console.log(`  Imported ${imported}...`);
    } else {
      failed++;
    }
  }

  console.log(`\nDone. ${imported} imported, ${failed} failed.`);
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);

  if (!command || command === 'help' || command === '--help') {
    console.log(HELP);
    process.exit(0);
  }

  if (command === 'reso') {
    await importReso(rest);
  } else if (command === 'csv') {
    await importCSV(rest);
  } else {
    console.error(`Unknown command: ${command}`);
    console.log(HELP);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Import failed:', err.message);
  process.exit(1);
});
