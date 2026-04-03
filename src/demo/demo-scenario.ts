const ALPHA = 'http://localhost:4001';
const BETA = 'http://localhost:4002';
const GAMMA = 'http://localhost:4003';

async function request(url: string, options?: RequestInit) {
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
  return res.json();
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function log(step: string, detail: string) {
  console.log(`\n[${'='.repeat(40)}]`);
  console.log(`  ${step}`);
  console.log(`  ${detail}`);
}

async function waitForNodes() {
  for (const [name, url] of [['Alpha', ALPHA], ['Beta', BETA], ['Gamma', GAMMA]]) {
    for (let i = 0; i < 20; i++) {
      try {
        await fetch(`${url}/health`);
        break;
      } catch {
        await sleep(500);
      }
    }
  }
}

async function run() {
  console.log('\n PeerMLS Federation Demo\n');
  console.log('Waiting for nodes...');
  await waitForNodes();
  console.log('All nodes ready.\n');

  // Step 1: Create a listing on Alpha (office visibility)
  log('STEP 1', 'Create listing on Alpha Realty (office only)');
  const created = await request(`${ALPHA}/api/v1/listings`, {
    method: 'POST',
    body: JSON.stringify({
      listingId: 'ALPHA-001',
      standardStatus: 'Active',
      visibility: 'office',
      propertyType: 'Residential',
      streetAddress: '742 Evergreen Terrace',
      city: 'Springfield',
      stateOrProvince: 'IL',
      postalCode: '62704',
      listPrice: 350000,
      bedroomsTotal: 4,
      bathroomsTotalInteger: 2,
      livingArea: 2200,
      yearBuilt: 1989,
      listAgentFullName: 'Marge Simpson',
      listOfficeName: 'Alpha Realty',
      publicRemarks: 'Charming family home. Good neighbors (mostly).',
    }),
  });
  console.log(`  Created: ${created.listingKey} (visibility: ${created.visibility})`);
  const listingKey = created.listingKey;

  // Step 2: Verify it does NOT appear on Beta
  await sleep(7000);
  log('STEP 2', 'Check Beta for the listing (should NOT be there)');
  const betaListings = await request(`${BETA}/api/v1/listings`) as any[];
  const found = betaListings.find((l: any) => l.listingKey === listingKey);
  console.log(`  Beta has listing: ${found ? 'YES (unexpected!)' : 'NO (correct)'}`);

  // Step 3: Update visibility to network
  log('STEP 3', 'Update listing to network visibility');
  await request(`${ALPHA}/api/v1/listings/${listingKey}`, {
    method: 'PATCH',
    body: JSON.stringify({ visibility: 'network' }),
  });
  console.log('  Visibility set to: network');

  // Step 4: Wait for sync and check Beta and Gamma
  console.log('  Waiting for sync...');
  await sleep(7000);
  log('STEP 4', 'Check Beta and Gamma for the listing');
  const betaAfter = await request(`${BETA}/api/v1/listings`) as any[];
  const gammaAfter = await request(`${GAMMA}/api/v1/listings`) as any[];
  const onBeta = betaAfter.find((l: any) => l.listingKey === listingKey);
  const onGamma = gammaAfter.find((l: any) => l.listingKey === listingKey);
  console.log(`  Beta has listing: ${onBeta ? 'YES' : 'NO'} ${onBeta ? `(${onBeta.streetAddress}, $${onBeta.listPrice})` : ''}`);
  console.log(`  Gamma has listing: ${onGamma ? 'YES' : 'NO'} ${onGamma ? `(${onGamma.streetAddress}, $${onGamma.listPrice})` : ''}`);

  // Step 5: Update the listing (price change) and verify it propagates
  log('STEP 5', 'Update price on Alpha (price reduction)');
  await request(`${ALPHA}/api/v1/listings/${listingKey}`, {
    method: 'PATCH',
    body: JSON.stringify({ listPrice: 325000 }),
  });
  console.log('  Price updated to: $325,000');

  console.log('  Waiting for sync...');
  await sleep(7000);
  log('STEP 6', 'Check Beta for updated price');
  const betaUpdated = await request(`${BETA}/api/v1/listings`) as any[];
  const updatedOnBeta = betaUpdated.find((l: any) => l.listingKey === listingKey);
  console.log(`  Beta price: $${updatedOnBeta?.listPrice} ${updatedOnBeta?.listPrice === 325000 ? '(updated!)' : '(stale)'}`);

  // Summary
  log('DONE', 'Federation demo complete');
  console.log('  1. Listing created locally (office only) — peers could not see it');
  console.log('  2. Visibility changed to network — peers replicated it');
  console.log('  3. Price updated on origin — peers got the update on next sync');
  console.log('  Once replicated, peers have the data. Just like IDX replication.\n');
}

run().catch(console.error);
