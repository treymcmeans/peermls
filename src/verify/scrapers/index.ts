import { searchAlabama, searchAlabamaByName, ALLicenseResult } from './alabama.js';

export interface LicenseCheckResult {
  valid: boolean;
  name?: string;
  licenseNumber?: string;
  licenseType?: string;
  status?: string;
  city?: string;
  state?: string;
  error?: string;
}

/** Supported states for live license verification */
const SUPPORTED_STATES = ['AL'];

export function isStateSupported(state: string): boolean {
  return SUPPORTED_STATES.includes(state.toUpperCase());
}

export function getSupportedStates(): string[] {
  return [...SUPPORTED_STATES];
}

/**
 * Check a license against the real state licensing database.
 * Returns structured result with license details or error.
 */
export async function checkLicenseLive(state: string, licenseNumber: string): Promise<LicenseCheckResult> {
  const normalizedState = state.toUpperCase();

  if (!isStateSupported(normalizedState)) {
    return { valid: false, error: `State ${normalizedState} not yet supported. Supported: ${SUPPORTED_STATES.join(', ')}` };
  }

  try {
    let results: ALLicenseResult[];

    if (normalizedState === 'AL') {
      results = await searchAlabama(licenseNumber);
    } else {
      return { valid: false, error: `No scraper for state ${normalizedState}` };
    }

    if (results.length === 0) {
      return { valid: false, error: 'License not found in state database' };
    }

    // Find the first active license (a person may have multiple license types)
    const active = results.find((r) => r.status.toLowerCase() === 'active');
    const best = active || results[0];

    if (best.status.toLowerCase() !== 'active') {
      return {
        valid: false,
        name: best.name,
        licenseNumber: best.licenseNumber,
        licenseType: best.licenseType,
        status: best.status,
        state: normalizedState,
        error: `License status: ${best.status}`,
      };
    }

    return {
      valid: true,
      name: best.name,
      licenseNumber: best.licenseNumber,
      licenseType: best.licenseType,
      status: best.status,
      city: best.city,
      state: normalizedState,
    };
  } catch (err: any) {
    return { valid: false, error: `Verification failed: ${err.message}` };
  }
}
