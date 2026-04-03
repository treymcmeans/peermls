export type StandardStatus = 'Active' | 'Pending' | 'Closed' | 'Withdrawn' | 'Expired' | 'ComingSoon';
export type PropertyType = 'Residential' | 'Commercial' | 'Land' | 'MultiFamily';
export type Visibility = 'office' | 'network';

export interface ResoListing {
  listingKey: string;
  originNodeId: string;
  listingId: string;
  standardStatus: StandardStatus;
  visibility: Visibility;
  propertyType: PropertyType;
  streetAddress: string | null;
  city: string | null;
  stateOrProvince: string | null;
  postalCode: string | null;
  listPrice: number | null;
  bedroomsTotal: number | null;
  bathroomsTotalInteger: number | null;
  livingArea: number | null;
  yearBuilt: number | null;
  listAgentFullName: string | null;
  listAgentLicense: string | null;
  listAgentLicenseState: string | null;
  listOfficeName: string | null;
  listOfficeLicense: string | null;
  listOfficeLicenseState: string | null;
  photos: string[] | null;
  latitude: number | null;
  longitude: number | null;
  closePrice: number | null;
  closeDate: string | null;
  originalListPrice: number | null;
  concessionsAmount: number | null;
  concessionsComments: string | null;
  buyerFinancing: string | null;
  buyerAgentFullName: string | null;
  buyerAgentLicense: string | null;
  buyerAgentLicenseState: string | null;
  buyerOfficeName: string | null;
  publicRemarks: string | null;
  modificationTimestamp: string;
  createdAt: string;
  isFederated: number;
}

export interface FederationResponse {
  nodeId: string;
  nodeName: string;
  timestamp: string;
  listings: ResoListing[];
}
