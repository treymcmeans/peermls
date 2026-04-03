import { AuthConfig, ODataResponse, ResoProperty } from './types.js';

/** Rate limiter matching Homepoint's pattern: simple delay between requests */
class RateLimiter {
  private lastRequest = 0;
  private delayMs: number;

  constructor(rps: number) {
    this.delayMs = Math.ceil(1000 / rps);
  }

  async wait() {
    const now = Date.now();
    const elapsed = now - this.lastRequest;
    if (elapsed < this.delayMs) {
      await new Promise((r) => setTimeout(r, this.delayMs - elapsed));
    }
    this.lastRequest = Date.now();
  }
}

/** Obtain a bearer token from an OAuth2 client credentials endpoint */
async function getOAuth2Token(tokenUrl: string, clientId: string, clientSecret: string, scope?: string): Promise<string> {
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  });
  if (scope) body.set('scope', scope);

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OAuth2 token request failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return data.access_token;
}

export class ResoClient {
  private baseUrl: string;
  private auth: AuthConfig;
  private rateLimiter: RateLimiter;
  private token: string | null = null;

  constructor(baseUrl: string, auth: AuthConfig, rps: number) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.auth = auth;
    this.rateLimiter = new RateLimiter(rps);
  }

  private async getToken(): Promise<string> {
    if (this.auth.type === 'bearer') return this.auth.token;
    if (this.auth.type === 'access_token') return this.auth.token;

    if (!this.token) {
      this.token = await getOAuth2Token(
        this.auth.tokenUrl,
        this.auth.clientId,
        this.auth.clientSecret,
        this.auth.scope
      );
    }
    return this.token;
  }

  private async request(url: string): Promise<ODataResponse> {
    await this.rateLimiter.wait();
    const token = await this.getToken();

    let fullUrl = url;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };

    if (this.auth.type === 'access_token') {
      // Bridge-style: token as query param
      const sep = fullUrl.includes('?') ? '&' : '?';
      fullUrl = `${fullUrl}${sep}access_token=${token}`;
    } else {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(fullUrl, { headers });

    if (res.status === 401 && this.auth.type === 'oauth2') {
      // Token expired, refresh and retry once
      this.token = null;
      const newToken = await this.getToken();
      headers['Authorization'] = `Bearer ${newToken}`;
      const retry = await fetch(fullUrl, { headers });
      if (!retry.ok) throw new Error(`RESO API error (${retry.status}): ${await retry.text()}`);
      return retry.json();
    }

    if (!res.ok) throw new Error(`RESO API error (${res.status}): ${await res.text()}`);
    return res.json();
  }

  /**
   * Fetch all listings matching the filter, following OData pagination.
   * Calls onBatch for each page so callers can process incrementally.
   */
  async fetchAll(
    officeFilter: { field: string; value: string },
    options: { pageSize: number; since?: string },
    onBatch: (listings: ResoProperty[], page: number) => Promise<void>
  ): Promise<number> {
    const filters: string[] = [];
    filters.push(`${officeFilter.field} eq '${officeFilter.value}'`);

    if (options.since) {
      filters.push(`ModificationTimestamp gt ${options.since}`);
    }

    const filterStr = filters.join(' and ');
    let url = `${this.baseUrl}/Property?$filter=${encodeURIComponent(filterStr)}&$top=${options.pageSize}&$orderby=ModificationTimestamp asc`;

    let page = 0;
    let total = 0;

    while (url) {
      const data = await this.request(url);
      const listings = data.value || [];

      if (listings.length > 0) {
        await onBatch(listings, page);
        total += listings.length;
      }

      // Follow OData pagination
      url = data['@odata.nextLink'] || '';
      page++;
    }

    return total;
  }
}
