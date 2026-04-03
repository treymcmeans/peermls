import * as cheerio from 'cheerio';

const BASE_URL = 'https://arec.alabama.gov/apps/LicenseSearch';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export interface ALLicenseResult {
  name: string;
  licenseNumber: string;
  licenseType: string;
  status: string;
  city: string;
}

/** Merge cookies from multiple responses, keyed by cookie name */
function mergeCookies(...headerSets: string[][]): string {
  const map = new Map<string, string>();
  for (const headers of headerSets) {
    for (const c of headers) {
      const pair = c.split(';')[0];
      const name = pair.split('=')[0];
      map.set(name, pair);
    }
  }
  return [...map.values()].join('; ');
}

/** Get session cookies and anti-forgery token */
async function getSession(): Promise<{ cookies: string[]; token: string }> {
  const res = await fetch(BASE_URL, { headers: { 'User-Agent': UA } });
  const html = await res.text();
  const cookies = res.headers.getSetCookie?.() || [];

  const $ = cheerio.load(html);
  const token = $('input[name="__RequestVerificationToken"]').first().val() as string;
  if (!token) throw new Error('Could not find anti-forgery token');

  return { cookies, token };
}

/** POST a form, follow redirect with merged cookies, parse results */
async function postAndGetResults(
  action: string,
  formData: URLSearchParams,
  sessionCookies: string[]
): Promise<ALLicenseResult[]> {
  const cookieHeader = mergeCookies(sessionCookies);

  // POST with manual redirect so we capture response cookies
  const res = await fetch(`${BASE_URL}/Home/${action}`, {
    method: 'POST',
    headers: {
      'User-Agent': UA,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': cookieHeader,
      'Referer': BASE_URL,
      'Origin': 'https://arec.alabama.gov',
    },
    body: formData.toString(),
    redirect: 'manual',
  });

  // Merge session cookies with POST response cookies (includes TempData with results)
  const postCookies = res.headers.getSetCookie?.() || [];
  const allCookies = mergeCookies(sessionCookies, postCookies);

  // Follow redirect to results page
  if (res.status >= 300 && res.status < 400) {
    const location = res.headers.get('location')!;
    const url = location.startsWith('http') ? location : `https://arec.alabama.gov${location}`;

    const resultsRes = await fetch(url, {
      headers: { 'User-Agent': UA, 'Cookie': allCookies },
    });
    return parseResults(await resultsRes.text());
  }

  return parseResults(await res.text());
}

function parseResults(html: string): ALLicenseResult[] {
  const $ = cheerio.load(html);
  const results: ALLicenseResult[] = [];

  // Results live inside #holder as .card elements
  // Each card: h5 (name) + table with license rows (td cells)
  $('#holder .card').each((_, card) => {
    const name = $(card).find('h5').first().text().trim();

    $(card).find('tr').each((_, row) => {
      const cells = $(row).find('td');
      if (cells.length >= 4) {
        results.push({
          name,
          licenseNumber: $(cells[0]).text().trim(),
          licenseType: $(cells[1]).text().trim(),
          status: $(cells[2]).text().trim(),
          city: $(cells[3]).text().trim(),
        });
      }
    });
  });

  return results;
}

/** Search by license number */
export async function searchAlabama(licenseNumber: string): Promise<ALLicenseResult[]> {
  const { cookies, token } = await getSession();
  const formData = new URLSearchParams();
  formData.set('__RequestVerificationToken', token);
  formData.set('LicenseNumber', licenseNumber);
  return postAndGetResults('LicenseNumber', formData, cookies);
}

/** Search by name */
export async function searchAlabamaByName(firstName: string, lastName: string): Promise<ALLicenseResult[]> {
  const { cookies, token } = await getSession();
  const formData = new URLSearchParams();
  formData.set('__RequestVerificationToken', token);
  formData.set('FirstName', firstName);
  formData.set('LastName', lastName);
  return postAndGetResults('LicenseeName', formData, cookies);
}
