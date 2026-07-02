import "server-only";

import type {
  BusinessRegistration,
  BusinessReputationProfile,
  Company,
  EntityDocument,
  NewBusinessRegistrationParty,
  NewBusinessReputationComplaint,
  NewBusinessReputationProfile,
  NewBusinessReputationReview,
  NewOccupancy,
  NewOwnership,
  NewProject,
  NewPropertyImprovement,
  NewSalesHistory,
  Occupancy,
  Project,
  Property,
  PropertyImprovement,
  PropertySignalRollup,
  Tenant,
} from "@/db/schema/types";
import type {
  Citation,
  EmbeddingService,
  RagAnswer,
  RagEvidence,
  RagMode,
} from "./rag/types";

export type { Citation, EmbeddingService, RagAnswer, RagEvidence, RagMode };

export type InquiryResultRow = Record<string, unknown> & {
  href?: string;
  citations?: Citation[];
};

export type InquiryResult = {
  inquiryId: string;
  label: string;
  columns: string[];
  rows: InquiryResultRow[];
};

export type PropertyFilters = {
  county?: string;
  municipality?: string;
  permitType?: string;
  contractor?: string;
  propertyClass?: string;
  businessType?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
};

export type ContractorFilters = {
  rating?: "negative" | "positive" | "all";
  sort?: "complaints" | "reviews" | "projects" | "score";
  trade?: string;
  query?: string;
  limit?: number;
  offset?: number;
};

export type BusinessFilters = {
  businessType?: string;
  status?: string;
  query?: string;
  limit?: number;
  offset?: number;
};

export type TenantFilters = {
  tenantType?: string;
  query?: string;
  limit?: number;
  offset?: number;
};

export type OwnershipRecord = NewOwnership & {
  ownerName: string | null;
  ownerKind: "person" | "company" | "unknown";
};

export type ContractorActivity = {
  companyId: string;
  name: string | null;
  permitCount: number;
  trades: string[];
  bbbRating: string | null;
  complaintCount: number | null;
};

export type RelatedBusiness = {
  businessRegistrationId: string | null;
  documentNumber: string | null;
  entityName: string | null;
  status: string | null;
  filingType: string | null;
  occupancyStatus: string | null;
  startDate: string | null;
  endDate: string | null;
};

export type RelatedProperty = {
  propertyId: string;
  parcelIdentifier: string | null;
  subdivision: string | null;
  municipalityName: string | null;
  propertyUsageType: string | null;
  relationship: string;
  permitCount?: number;
};

export type PropertyDetail = {
  property: Property;
  ownershipHistory: OwnershipRecord[];
  salesHistory: NewSalesHistory[];
  permits: NewPropertyImprovement[];
  openPermits: NewPropertyImprovement[];
  majorImprovements: NewPropertyImprovement[];
  contractorActivity: ContractorActivity[];
  businesses: RelatedBusiness[];
  occupancies: NewOccupancy[];
  projects: NewProject[];
  rollup: PropertySignalRollup | null;
};

export type TenantDetail = {
  tenant: Tenant;
  occupancies: NewOccupancy[];
  properties: RelatedProperty[];
  businesses: RelatedBusiness[];
  permits: NewPropertyImprovement[];
  projects: NewProject[];
};

export type BusinessDetail = {
  business: BusinessRegistration;
  company: Company | null;
  parties: NewBusinessRegistrationParty[];
  properties: RelatedProperty[];
  permits: NewPropertyImprovement[];
  projects: NewProject[];
};

export type ContractorDetail = {
  company: Company;
  reputation: NewBusinessReputationProfile | null;
  reviews: NewBusinessReputationReview[];
  complaints: NewBusinessReputationComplaint[];
  reviewSummary: {
    averageRating: number | null;
    reviewCount: number;
    positiveCount: number;
    negativeCount: number;
  };
  permits: NewPropertyImprovement[];
  projects: NewProject[];
  properties: RelatedProperty[];
  isNegative: boolean;
};

export type ContractorListItem = Company & {
  bbbRating: string | null;
  complaintCount: number | null;
  reviewAverageRating: string | null;
  reviewCount: number | null;
  permitCount: number;
  trade: string | null;
  isNegative: boolean;
};

export type DashboardStats = {
  properties: number;
  permits: number;
  openPermits: number;
  contractors: number;
  negativeContractors: number;
  businesses: number;
  tenants: number;
  projects: number;
  majorRenovations: number;
  multiOpenPermitProperties: number;
};

export type FilterFacets = {
  counties: string[];
  municipalities: string[];
  permitTypes: string[];
  propertyClasses: string[];
  businessTypes: string[];
  contractorTrades: string[];
};

export interface DataAccess {
  listProperties(filters?: PropertyFilters): Promise<Property[]>;
  getPropertyById(propertyId: string): Promise<Property | null>;
  getPropertyByParcelIdentifier(parcelIdentifier: string): Promise<Property | null>;
  getPropertyDetail(propertyId: string): Promise<PropertyDetail | null>;

  searchPermits(filters?: PropertyFilters): Promise<PropertyImprovement[]>;
  getPermitByNumber(permitNumber: string): Promise<PropertyImprovement | null>;
  listPermitsForProperty(propertyId: string): Promise<PropertyImprovement[]>;

  searchCompanies(query: string, limit?: number): Promise<Company[]>;
  listContractors(filters?: ContractorFilters): Promise<ContractorListItem[]>;
  getBusinessReputationDetail(
    companyId: string,
  ): Promise<BusinessReputationProfile | null>;
  listContractorQualityScoresForPermitNumber(
    permitNumber: string,
  ): Promise<Company[]>;
  getContractorDetail(companyId: string): Promise<ContractorDetail | null>;

  listBusinesses(filters?: BusinessFilters): Promise<BusinessRegistration[]>;
  getBusinessDetail(documentNumber: string): Promise<BusinessDetail | null>;

  listTenants(filters?: TenantFilters): Promise<Tenant[]>;
  getTenantById(tenantId: string): Promise<Tenant | null>;
  listOccupanciesForTenant(tenantId: string): Promise<Occupancy[]>;
  listOccupanciesForProperty(propertyId: string): Promise<Occupancy[]>;
  getTenantDetail(tenantId: string): Promise<TenantDetail | null>;

  listProjects(limit?: number): Promise<Project[]>;
  listProjectsForProperty(propertyId: string): Promise<Project[]>;

  getRollupForProperty(propertyId: string): Promise<PropertySignalRollup | null>;
  runInquiry(inquiryId: string): Promise<InquiryResult>;
  getDashboardStats(): Promise<DashboardStats>;
  getFilterFacets(): Promise<FilterFacets>;

  ragRetrieve(query: string, limit?: number): Promise<RagEvidence[]>;
  ragSearchDocuments(query: string, limit?: number): Promise<EntityDocument[]>;
  answerQuestion(question: string): Promise<RagAnswer>;
}
