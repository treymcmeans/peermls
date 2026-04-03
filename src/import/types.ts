/** Raw RESO property from any OData-compliant MLS feed */
export interface ResoProperty {
  ListingKey?: string;
  ListingId?: string;
  UnparsedAddress?: string;
  StreetNumber?: string;
  StreetName?: string;
  StreetDirPrefix?: string;
  StreetDirSuffix?: string;
  StreetSuffix?: string;
  UnitNumber?: string;
  City?: string;
  StateOrProvince?: string;
  PostalCode?: string;
  ListPrice?: number;
  ClosePrice?: number;
  OriginalListPrice?: number;
  StandardStatus?: string;
  PropertyType?: string;
  PropertySubType?: string;
  BedroomsTotal?: number;
  BathroomsTotalInteger?: number;
  BathroomsTotalDecimal?: number;
  BathroomsFull?: number;
  BathroomsHalf?: number;
  LivingArea?: number;
  BuildingAreaTotal?: number;
  YearBuilt?: number;
  DaysOnMarket?: number;
  ListingContractDate?: string;
  CloseDate?: string;
  ModificationTimestamp?: string;
  OriginalEntryTimestamp?: string;
  ListAgentFullName?: string;
  ListAgentKey?: string;
  ListAgentMlsId?: string;
  ListOfficeName?: string;
  ListOfficeKey?: string;
  ListOfficeMlsId?: string;
  PublicRemarks?: string;
  SyndicationRemarks?: string;
  BuyerAgentFullName?: string;
  BuyerOfficeName?: string;
  SubdivisionName?: string;
  [key: string]: any; // vendor-specific fields pass through
}

/** OData response envelope */
export interface ODataResponse {
  '@odata.context'?: string;
  '@odata.nextLink'?: string;
  '@odata.count'?: number;
  value: ResoProperty[];
}

/** Auth config for different MLS vendor API flavors */
export type AuthConfig =
  | { type: 'bearer'; token: string }
  | { type: 'oauth2'; tokenUrl: string; clientId: string; clientSecret: string; scope?: string }
  | { type: 'access_token'; token: string }; // Bridge-style query param token

export interface ImportConfig {
  /** MLS vendor API base URL */
  apiUrl: string;
  /** Auth configuration */
  auth: AuthConfig;
  /** Filter to your brokerage's listings */
  officeFilter: { field: string; value: string };
  /** Target PeerMLS node URL */
  nodeUrl: string;
  /** Visibility for imported listings */
  visibility: 'office' | 'network';
  /** Page size for OData queries */
  pageSize: number;
  /** Rate limit (requests per second) */
  rps: number;
  /** Only import listings modified after this timestamp */
  since?: string;
}
