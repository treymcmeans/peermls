import { ResoProperty } from './types.js';

/** Normalize a RESO StandardStatus to PeerMLS's status enum */
export function normalizeStatus(prop: ResoProperty): string {
  const status = (prop.StandardStatus || '').toLowerCase();

  if (status.includes('closed') || status.includes('sold') || prop.CloseDate) return 'Closed';
  if (status.includes('pending') || status.includes('under contract')) return 'Pending';
  if (status.includes('coming soon')) return 'ComingSoon';
  if (status.includes('withdrawn')) return 'Withdrawn';
  if (status.includes('expired') || status.includes('cancel') || status.includes('terminated')) return 'Expired';
  if (status.includes('active')) return 'Active';

  return 'Active';
}

/** Normalize property type */
export function normalizePropertyType(type?: string, subType?: string): string {
  const combined = ((type || '') + ' ' + (subType || '')).toLowerCase();

  if (combined.includes('residential') || combined.includes('single family')) return 'Residential';
  if (combined.includes('commercial')) return 'Commercial';
  if (combined.includes('land') || combined.includes('lot')) return 'Land';
  if (combined.includes('multi')) return 'MultiFamily';

  return 'Residential';
}

/** Build a street address from parsed components or UnparsedAddress */
export function buildAddress(prop: ResoProperty): string {
  const parts: string[] = [];

  if (prop.StreetNumber) parts.push(prop.StreetNumber);
  if (prop.StreetDirPrefix) parts.push(prop.StreetDirPrefix);
  if (prop.StreetName) parts.push(prop.StreetName);
  if (prop.StreetSuffix) parts.push(prop.StreetSuffix);
  if (prop.StreetDirSuffix) parts.push(prop.StreetDirSuffix);

  const constructed = parts.join(' ').trim();
  return constructed || prop.UnparsedAddress || '';
}

/** Normalize bathroom count across vendor variations */
export function normalizeBathrooms(prop: ResoProperty): number | null {
  if (prop.BathroomsTotalInteger != null) return prop.BathroomsTotalInteger;
  if (prop.BathroomsTotalDecimal != null) return Math.round(prop.BathroomsTotalDecimal);
  if (prop.BathroomsFull != null) return prop.BathroomsFull + Math.floor((prop.BathroomsHalf || 0) / 2);
  return null;
}

/** Transform a raw RESO property into an PeerMLS listing payload */
export function transformToPeerMLS(prop: ResoProperty, visibility: 'office' | 'network') {
  return {
    listingId: prop.ListingId || prop.ListingKey || '',
    standardStatus: normalizeStatus(prop),
    visibility,
    propertyType: normalizePropertyType(prop.PropertyType, prop.PropertySubType),
    streetAddress: buildAddress(prop) || null,
    city: prop.City || null,
    stateOrProvince: prop.StateOrProvince || null,
    postalCode: prop.PostalCode || null,
    listPrice: prop.ListPrice || null,
    bedroomsTotal: prop.BedroomsTotal || null,
    bathroomsTotalInteger: normalizeBathrooms(prop),
    livingArea: prop.LivingArea || prop.BuildingAreaTotal || null,
    yearBuilt: prop.YearBuilt || null,
    listAgentFullName: prop.ListAgentFullName || null,
    listOfficeName: prop.ListOfficeName || null,
    photos: prop.Media?.map((m: any) => m.MediaURL).filter(Boolean) || null,
    latitude: prop.Latitude || null,
    longitude: prop.Longitude || null,
    closePrice: prop.ClosePrice || null,
    closeDate: prop.CloseDate || null,
    originalListPrice: prop.OriginalListPrice || null,
    concessionsAmount: prop.ConcessionsAmount || null,
    concessionsComments: prop.ConcessionsComments || null,
    buyerFinancing: prop.BuyerFinancing || null,
    buyerAgentFullName: prop.BuyerAgentFullName || null,
    buyerOfficeName: prop.BuyerOfficeName || null,
    publicRemarks: prop.PublicRemarks || prop.SyndicationRemarks || null,
  };
}
