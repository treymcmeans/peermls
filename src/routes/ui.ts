import { FastifyInstance } from 'fastify';
import Database from 'better-sqlite3';
import { NodeConfig } from '../config.js';

export function registerUIRoutes(app: FastifyInstance, db: Database.Database, config: NodeConfig) {
  app.get('/ui', (req, reply) => {
    const verifyUrl = config.trustedIssuers[0] || 'http://localhost:4000';

    reply.type('text/html').send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PeerMLS — ${config.nodeName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; color: #1a1a1a; }
    .container { max-width: 960px; margin: 0 auto; padding: 20px; }
    h1 { font-size: 24px; margin-bottom: 4px; }
    .subtitle { color: #666; font-size: 14px; margin-bottom: 24px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
    .card { background: #fff; border-radius: 8px; padding: 20px; border: 1px solid #e0e0e0; }
    .card h2 { font-size: 16px; margin-bottom: 12px; color: #333; }
    .stat { font-size: 32px; font-weight: 700; }
    .stat-label { font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; }
    .badge-green { background: #dcfce7; color: #166534; }
    .badge-yellow { background: #fef9c3; color: #854d0e; }
    .badge-red { background: #fee2e2; color: #991b1b; }
    .badge-blue { background: #dbeafe; color: #1e40af; }
    .badge-gray { background: #f3f4f6; color: #374151; }
    .full { grid-column: 1 / -1; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th { text-align: left; padding: 8px; border-bottom: 2px solid #e0e0e0; font-size: 12px; text-transform: uppercase; color: #888; letter-spacing: 0.5px; }
    td { padding: 8px; border-bottom: 1px solid #f0f0f0; }
    tr:hover td { background: #f9f9f9; }
    .empty { color: #aaa; font-style: italic; padding: 20px; text-align: center; }
    .tabs { display: flex; gap: 0; margin-bottom: 0; border-bottom: 2px solid #e0e0e0; }
    .tab { padding: 8px 16px; cursor: pointer; border: none; background: none; font-size: 14px; color: #666; border-bottom: 2px solid transparent; margin-bottom: -2px; }
    .tab.active { color: #1a1a1a; border-bottom-color: #1a1a1a; font-weight: 600; }
    .tab-content { display: none; }
    .tab-content.active { display: block; }
    .verify-form { display: flex; gap: 8px; margin-bottom: 16px; }
    .verify-form input, .verify-form select { padding: 8px 12px; border: 1px solid #d0d0d0; border-radius: 6px; font-size: 14px; }
    .verify-form input { flex: 1; }
    .verify-form button { padding: 8px 20px; background: #1a1a1a; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; }
    .verify-form button:hover { background: #333; }
    .verify-result { padding: 16px; border-radius: 6px; margin-top: 12px; font-size: 14px; }
    .verify-result.success { background: #dcfce7; border: 1px solid #86efac; }
    .verify-result.error { background: #fee2e2; border: 1px solid #fca5a5; }
    .peer-row { display: flex; align-items: center; gap: 8px; padding: 8px 0; border-bottom: 1px solid #f0f0f0; }
    .peer-dot { width: 8px; height: 8px; border-radius: 50%; background: #22c55e; }
    .log-entry { padding: 8px 0; border-bottom: 1px solid #f0f0f0; font-size: 13px; }
    .log-time { color: #888; font-size: 12px; }
    .mono { font-family: 'SF Mono', Monaco, monospace; font-size: 12px; color: #666; }
    .refresh { padding: 4px 12px; background: #f0f0f0; border: 1px solid #d0d0d0; border-radius: 4px; cursor: pointer; font-size: 12px; float: right; }
    .refresh:hover { background: #e0e0e0; }
    .price { font-weight: 600; }
    @media (max-width: 640px) { .grid { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <div class="container">
    <h1>PeerMLS</h1>
    <p class="subtitle">${config.nodeName} &mdash; ${config.license ? config.license.state + '-' + config.license.number : 'No license'} ${config.attestation ? '<span class="badge badge-green">Verified</span>' : '<span class="badge badge-yellow">Unverified</span>'}</p>

    <div class="tabs">
      <button class="tab active" onclick="showTab('dashboard')">Dashboard</button>
      <button class="tab" onclick="showTab('listings')">Listings</button>
      <button class="tab" onclick="showTab('verify')">Verify License</button>
      <button class="tab" onclick="showTab('federation')">Federation</button>
      <button class="tab" onclick="showTab('log')">Transparency Log</button>
    </div>

    <!-- Dashboard -->
    <div id="tab-dashboard" class="tab-content active">
      <div class="grid" style="margin-top: 16px;">
        <div class="card">
          <div class="stat-label">Local Listings</div>
          <div class="stat" id="local-count">—</div>
        </div>
        <div class="card">
          <div class="stat-label">Federated Listings</div>
          <div class="stat" id="fed-count">—</div>
        </div>
        <div class="card">
          <div class="stat-label">Connected Peers</div>
          <div class="stat" id="peer-count">—</div>
        </div>
        <div class="card">
          <div class="stat-label">Node Status</div>
          <div class="stat" id="node-status">—</div>
        </div>
      </div>
    </div>

    <!-- Listings -->
    <div id="tab-listings" class="tab-content">
      <div class="card full" style="margin-top: 16px;">
        <h2>All Listings <button class="refresh" onclick="loadListings()">Refresh</button></h2>
        <div id="listings-table"></div>
      </div>
    </div>

    <!-- Verify -->
    <div id="tab-verify" class="tab-content">
      <div class="card full" style="margin-top: 16px;">
        <h2>Verify a License</h2>
        <p style="color: #666; font-size: 13px; margin-bottom: 12px;">Check a broker or agent license against the state licensing database.</p>
        <div class="verify-form">
          <select id="verify-state">
            <option value="AL">Alabama</option>
          </select>
          <input type="text" id="verify-license" placeholder="License number (e.g., 165855)">
          <input type="text" id="verify-nodeid" placeholder="Node ID (e.g., my-brokerage)">
          <button onclick="verifyLicense()">Verify</button>
        </div>
        <div id="verify-result"></div>
      </div>
    </div>

    <!-- Federation -->
    <div id="tab-federation" class="tab-content">
      <div class="grid" style="margin-top: 16px;">
        <div class="card full">
          <h2>Peers <button class="refresh" onclick="loadPeers()">Refresh</button></h2>
          <div id="peers-list"></div>
        </div>
        <div class="card full">
          <h2>This Node</h2>
          <div id="node-info"></div>
        </div>
      </div>
    </div>

    <!-- Transparency Log -->
    <div id="tab-log" class="tab-content">
      <div class="card full" style="margin-top: 16px;">
        <h2>Attestation Transparency Log <button class="refresh" onclick="loadLog()">Refresh</button></h2>
        <p style="color: #666; font-size: 13px; margin-bottom: 12px;">Public, append-only log of all license verifications. Anyone can audit.</p>
        <div id="log-entries"></div>
      </div>
    </div>
  </div>

  <script>
    const API = '';
    const VERIFY_URL = '${verifyUrl}';

    function showTab(name) {
      document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
      document.querySelectorAll('.tab').forEach(el => el.classList.remove('active'));
      document.getElementById('tab-' + name).classList.add('active');
      event.target.classList.add('active');

      if (name === 'listings') loadListings();
      if (name === 'federation') { loadPeers(); loadNodeInfo(); }
      if (name === 'log') loadLog();
    }

    async function loadDashboard() {
      try {
        const res = await fetch(API + '/health');
        const data = await res.json();
        document.getElementById('local-count').textContent = data.localListings;
        document.getElementById('fed-count').textContent = data.federatedListings;
        document.getElementById('peer-count').textContent = data.peers.length;
        document.getElementById('node-status').innerHTML = data.verified
          ? '<span class="badge badge-green">Verified</span>'
          : '<span class="badge badge-yellow">Unverified</span>';
      } catch (e) {
        console.error('Failed to load dashboard:', e);
      }
    }

    async function loadListings() {
      try {
        const res = await fetch(API + '/api/v1/listings');
        const listings = await res.json();

        if (listings.length === 0) {
          document.getElementById('listings-table').innerHTML = '<div class="empty">No listings yet. Create one via the API.</div>';
          return;
        }

        let html = '<table><thead><tr><th>ID</th><th>Address</th><th>Price</th><th>Status</th><th>Agent</th><th>Origin</th></tr></thead><tbody>';
        for (const l of listings) {
          const addr = [l.streetAddress, l.city, l.stateOrProvince].filter(Boolean).join(', ');
          const price = l.listPrice ? '$' + l.listPrice.toLocaleString() : '—';
          const statusClass = l.standardStatus === 'Active' ? 'badge-green' : l.standardStatus === 'Pending' ? 'badge-yellow' : l.standardStatus === 'Closed' ? 'badge-gray' : 'badge-red';
          const origin = l.isFederated ? '<span class="badge badge-blue">Federated</span>' : '<span class="badge badge-gray">Local</span>';
          html += '<tr>';
          html += '<td class="mono">' + l.listingId + '</td>';
          html += '<td>' + (addr || '—') + '</td>';
          html += '<td class="price">' + price + '</td>';
          html += '<td><span class="badge ' + statusClass + '">' + l.standardStatus + '</span></td>';
          html += '<td>' + (l.listAgentFullName || '—') + (l.listAgentLicense ? ' <span class="mono">(' + l.listAgentLicenseState + '-' + l.listAgentLicense + ')</span>' : '') + '</td>';
          html += '<td>' + origin + '</td>';
          html += '</tr>';
        }
        html += '</tbody></table>';
        document.getElementById('listings-table').innerHTML = html;
      } catch (e) {
        document.getElementById('listings-table').innerHTML = '<div class="empty">Failed to load listings.</div>';
      }
    }

    async function verifyLicense() {
      const state = document.getElementById('verify-state').value;
      const license = document.getElementById('verify-license').value;
      const nodeId = document.getElementById('verify-nodeid').value || 'test-node';
      const resultDiv = document.getElementById('verify-result');

      if (!license) { resultDiv.innerHTML = '<div class="verify-result error">Enter a license number.</div>'; return; }

      resultDiv.innerHTML = '<div class="verify-result" style="background:#f0f0f0;border:1px solid #d0d0d0;">Checking against ' + state + ' state database...</div>';

      try {
        const res = await fetch(VERIFY_URL + '/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nodeId, license, state }),
        });
        const data = await res.json();

        if (data.verified) {
          resultDiv.innerHTML = '<div class="verify-result success">' +
            '<strong>' + data.name + '</strong><br>' +
            'License: ' + data.licenseNumber + '<br>' +
            'Type: ' + data.rawLicenseType + ' (' + data.licenseType + ')<br>' +
            'Status: <span class="badge badge-green">' + data.status + '</span><br>' +
            'City: ' + data.city + ', ' + data.state + '<br>' +
            '<br><span class="mono" style="word-break:break-all;">Attestation: ' + data.attestation.substring(0, 60) + '...</span>' +
            '</div>';
        } else {
          resultDiv.innerHTML = '<div class="verify-result error">' +
            '<strong>Verification Failed</strong><br>' + data.error +
            (data.details ? '<br>Name: ' + (data.details.name || 'N/A') + '<br>Status: ' + (data.details.status || 'N/A') : '') +
            '</div>';
        }
      } catch (e) {
        resultDiv.innerHTML = '<div class="verify-result error">Failed to connect to verification service.</div>';
      }
    }

    async function loadPeers() {
      try {
        const res = await fetch(API + '/peers');
        const data = await res.json();

        if (data.peers.length === 0) {
          document.getElementById('peers-list').innerHTML = '<div class="empty">No peers connected.</div>';
          return;
        }

        let html = '';
        for (const p of data.peers) {
          html += '<div class="peer-row">';
          html += '<div class="peer-dot"></div>';
          html += '<strong>' + p.nodeId + '</strong>';
          html += ' &mdash; <span class="mono">' + p.baseUrl + '</span>';
          html += p.lastSyncAt ? ' &mdash; <span style="color:#888;font-size:12px;">last sync: ' + new Date(p.lastSyncAt).toLocaleTimeString() + '</span>' : '';
          html += '</div>';
        }
        document.getElementById('peers-list').innerHTML = html;
      } catch (e) {
        document.getElementById('peers-list').innerHTML = '<div class="empty">Failed to load peers.</div>';
      }
    }

    async function loadNodeInfo() {
      try {
        const res = await fetch(API + '/federation/v1/node-info');
        const data = await res.json();
        let html = '<table>';
        html += '<tr><td><strong>Node ID</strong></td><td>' + data.nodeId + '</td></tr>';
        html += '<tr><td><strong>Name</strong></td><td>' + data.nodeName + '</td></tr>';
        html += '<tr><td><strong>Total Listings</strong></td><td>' + data.totalListings + '</td></tr>';
        html += '<tr><td><strong>Network Listings</strong></td><td>' + data.networkListings + '</td></tr>';
        if (data.license) html += '<tr><td><strong>License</strong></td><td>' + data.license.state + '-' + data.license.number + '</td></tr>';
        html += '<tr><td><strong>Attestation</strong></td><td>' + (data.attestation ? '<span class="badge badge-green">Present</span>' : '<span class="badge badge-yellow">None</span>') + '</td></tr>';
        html += '</table>';
        document.getElementById('node-info').innerHTML = html;
      } catch (e) {
        document.getElementById('node-info').innerHTML = '<div class="empty">Failed to load node info.</div>';
      }
    }

    async function loadLog() {
      try {
        const res = await fetch(VERIFY_URL + '/transparency-log');
        const data = await res.json();

        if (data.entries === 0) {
          document.getElementById('log-entries').innerHTML = '<div class="empty">No attestations issued yet.</div>';
          return;
        }

        let html = '<table><thead><tr><th>Time</th><th>Node</th><th>License</th><th>Name</th><th>Type</th><th>Hash</th></tr></thead><tbody>';
        for (const e of data.log) {
          html += '<tr>';
          html += '<td class="log-time">' + new Date(e.timestamp).toLocaleString() + '</td>';
          html += '<td><strong>' + e.nodeId + '</strong></td>';
          html += '<td class="mono">' + e.license + '</td>';
          html += '<td>' + e.name + '</td>';
          html += '<td><span class="badge ' + (e.type === 'broker' ? 'badge-blue' : 'badge-gray') + '">' + e.type + '</span></td>';
          html += '<td class="mono">' + e.attestationHash + '</td>';
          html += '</tr>';
        }
        html += '</tbody></table>';
        document.getElementById('log-entries').innerHTML = html;
      } catch (e) {
        document.getElementById('log-entries').innerHTML = '<div class="empty">Failed to load transparency log.</div>';
      }
    }

    // Load dashboard on start
    loadDashboard();
    setInterval(loadDashboard, 5000);
  </script>
</body>
</html>`);
  });
}
