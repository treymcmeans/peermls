import { readFileSync } from 'fs';
import { ResoProperty } from './types.js';

/**
 * Common CSV column name variations mapped to RESO field names.
 * MLSs export CSVs with inconsistent column headers.
 * This handles the most common variations.
 */
const COLUMN_MAP: Record<string, keyof ResoProperty> = {
  // Listing ID variations
  'mls #': 'ListingId',
  'mls#': 'ListingId',
  'mls number': 'ListingId',
  'listing id': 'ListingId',
  'listingid': 'ListingId',
  'listing number': 'ListingId',
  'listing key': 'ListingKey',
  'listingkey': 'ListingKey',

  // Address variations
  'address': 'UnparsedAddress',
  'full address': 'UnparsedAddress',
  'street address': 'UnparsedAddress',
  'unparsedaddress': 'UnparsedAddress',
  'street number': 'StreetNumber',
  'street name': 'StreetName',
  'unit': 'UnitNumber',
  'unit number': 'UnitNumber',
  'unit #': 'UnitNumber',

  // Location
  'city': 'City',
  'state': 'StateOrProvince',
  'stateorprovince': 'StateOrProvince',
  'zip': 'PostalCode',
  'zip code': 'PostalCode',
  'postal code': 'PostalCode',
  'postalcode': 'PostalCode',

  // Price
  'list price': 'ListPrice',
  'listprice': 'ListPrice',
  'price': 'ListPrice',
  'asking price': 'ListPrice',
  'close price': 'ClosePrice',
  'closeprice': 'ClosePrice',
  'sold price': 'ClosePrice',
  'sale price': 'ClosePrice',
  'original list price': 'OriginalListPrice',

  // Status
  'status': 'StandardStatus',
  'standardstatus': 'StandardStatus',
  'mls status': 'StandardStatus',

  // Property details
  'beds': 'BedroomsTotal',
  'bedrooms': 'BedroomsTotal',
  'bedroomstotal': 'BedroomsTotal',
  'br': 'BedroomsTotal',
  'baths': 'BathroomsTotalInteger',
  'bathrooms': 'BathroomsTotalInteger',
  'bathroomstotalinteger': 'BathroomsTotalInteger',
  'ba': 'BathroomsTotalInteger',
  'sqft': 'LivingArea',
  'sq ft': 'LivingArea',
  'square feet': 'LivingArea',
  'living area': 'LivingArea',
  'livingarea': 'LivingArea',
  'area': 'LivingArea',
  'year built': 'YearBuilt',
  'yearbuilt': 'YearBuilt',

  // Type
  'property type': 'PropertyType',
  'propertytype': 'PropertyType',
  'type': 'PropertyType',
  'property sub type': 'PropertySubType',
  'propertysubtype': 'PropertySubType',

  // Agent/Office
  'listing agent': 'ListAgentFullName',
  'list agent': 'ListAgentFullName',
  'listagentfullname': 'ListAgentFullName',
  'agent': 'ListAgentFullName',
  'listing office': 'ListOfficeName',
  'list office': 'ListOfficeName',
  'listofficename': 'ListOfficeName',
  'office': 'ListOfficeName',

  // Dates
  'close date': 'CloseDate',
  'closedate': 'CloseDate',
  'sold date': 'CloseDate',
  'list date': 'ListingContractDate',
  'date listed': 'ListingContractDate',
  'dom': 'DaysOnMarket',
  'days on market': 'DaysOnMarket',

  // Remarks
  'remarks': 'PublicRemarks',
  'public remarks': 'PublicRemarks',
  'publicremarks': 'PublicRemarks',
  'description': 'PublicRemarks',
};

/** Parse a CSV string into rows, handling quoted fields with commas */
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

/** Read a CSV file and map columns to RESO property fields */
export function readCSV(filePath: string): ResoProperty[] {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/).filter((l) => l.trim());

  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]);
  const columnMapping: (keyof ResoProperty | null)[] = headers.map((h) => {
    const normalized = h.toLowerCase().trim();
    return COLUMN_MAP[normalized] || null;
  });

  const unmapped = headers.filter((_, i) => !columnMapping[i]);
  if (unmapped.length > 0) {
    console.log(`  Unmapped CSV columns (ignored): ${unmapped.join(', ')}`);
  }

  const mapped = headers.filter((_, i) => columnMapping[i]);
  console.log(`  Mapped CSV columns: ${mapped.join(', ')}`);

  const properties: ResoProperty[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const prop: ResoProperty = {};

    for (let j = 0; j < values.length; j++) {
      const field = columnMapping[j];
      if (!field || !values[j]) continue;

      const val = values[j];

      // Parse numeric fields
      if (['ListPrice', 'ClosePrice', 'OriginalListPrice', 'LivingArea', 'BuildingAreaTotal'].includes(field)) {
        const num = parseFloat(val.replace(/[$,]/g, ''));
        if (!isNaN(num)) prop[field] = num;
      } else if (['BedroomsTotal', 'BathroomsTotalInteger', 'YearBuilt', 'DaysOnMarket'].includes(field)) {
        const num = parseInt(val, 10);
        if (!isNaN(num)) prop[field] = num;
      } else {
        prop[field] = val;
      }
    }

    if (prop.ListingId || prop.ListingKey || prop.UnparsedAddress) {
      properties.push(prop);
    }
  }

  return properties;
}
