import { z } from 'zod';

const standardStatuses = ['Active', 'Pending', 'Closed', 'Withdrawn', 'Expired', 'ComingSoon'] as const;
const propertyTypes = ['Residential', 'Commercial', 'Land', 'MultiFamily'] as const;
const visibilities = ['office', 'network'] as const;

const baseFields = {
  listingId: z.string().min(1),
  standardStatus: z.enum(standardStatuses).default('Active'),
  visibility: z.enum(visibilities).default('office'),
  propertyType: z.enum(propertyTypes).default('Residential'),
  streetAddress: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  stateOrProvince: z.string().max(2).nullable().optional(),
  postalCode: z.string().nullable().optional(),
  listPrice: z.number().positive().nullable().optional(),
  bedroomsTotal: z.number().int().min(0).nullable().optional(),
  bathroomsTotalInteger: z.number().int().min(0).nullable().optional(),
  livingArea: z.number().positive().nullable().optional(),
  yearBuilt: z.number().int().min(1600).max(2100).nullable().optional(),
  listAgentFullName: z.string().nullable().optional(),
  listAgentLicense: z.string().nullable().optional(),
  listAgentLicenseState: z.string().max(2).nullable().optional(),
  listOfficeName: z.string().nullable().optional(),
  listOfficeLicense: z.string().nullable().optional(),
  listOfficeLicenseState: z.string().max(2).nullable().optional(),
  photos: z.array(z.string().url()).nullable().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  closePrice: z.number().positive().nullable().optional(),
  closeDate: z.string().nullable().optional(),
  originalListPrice: z.number().positive().nullable().optional(),
  concessionsAmount: z.number().min(0).nullable().optional(),
  concessionsComments: z.string().nullable().optional(),
  buyerFinancing: z.string().nullable().optional(),
  buyerAgentFullName: z.string().nullable().optional(),
  buyerAgentLicense: z.string().nullable().optional(),
  buyerAgentLicenseState: z.string().max(2).nullable().optional(),
  buyerOfficeName: z.string().nullable().optional(),
  publicRemarks: z.string().nullable().optional(),
};

export const createListingSchema = z.object(baseFields).superRefine((data, ctx) => {
  if (data.visibility === 'network') {
    if (!data.streetAddress) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Street address is required for network listings', path: ['streetAddress'] });
    }
    if (!data.city) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'City is required for network listings', path: ['city'] });
    }
    if (!data.stateOrProvince) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'State is required for network listings', path: ['stateOrProvince'] });
    }
    if (!data.listPrice) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'List price is required for network listings', path: ['listPrice'] });
    }
    if (!data.listAgentFullName) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Listing agent name is required for network listings', path: ['listAgentFullName'] });
    }
    if (!data.listOfficeName) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Listing office name is required for network listings', path: ['listOfficeName'] });
    }
  }
});

export const updateListingSchema = z.object(baseFields).partial();

export type CreateListingInput = z.infer<typeof createListingSchema>;
export type UpdateListingInput = z.infer<typeof updateListingSchema>;
