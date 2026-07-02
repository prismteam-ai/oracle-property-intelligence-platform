import type {
  addresses,
  companies,
  people,
  unnormalizedAddresses,
} from "./core";
import type {
  deeds,
  factSheets,
  files,
  floodStormInformation,
  geometries,
  layouts,
  lots,
  ownerships,
  parcels,
  properties,
  propertyValuations,
  salesHistories,
  structures,
  taxes,
  utilities,
} from "./appraisal";
import type {
  inspections,
  permitContacts,
  permitCustomFields,
  permitEvents,
  permitFees,
  permitLinks,
  permitListWindows,
  propertyImprovements,
} from "./permits";
import type {
  businessRegistrationAddresses,
  businessRegistrationAnnualReports,
  businessRegistrationEvents,
  businessRegistrationParties,
  businessRegistrations,
  sunbizExtractionChunks,
} from "./sunbiz";
import type {
  businessReputationComplaintEvents,
  businessReputationComplaints,
  businessReputationProfiles,
  businessReputationReviews,
  contractorQualityScores,
} from "./bbb";
import type { occupancies, tenants } from "./tenancy";
import type {
  projectContractors,
  projectPermits,
  projects,
} from "./projects";
import type { publicRecords } from "./public_records";
import type { propertySignalRollups } from "./analytics";
import type { entityDocuments } from "./rag";

export type Address = typeof addresses.$inferSelect;
export type NewAddress = typeof addresses.$inferInsert;
export type UnnormalizedAddress = typeof unnormalizedAddresses.$inferSelect;
export type NewUnnormalizedAddress = typeof unnormalizedAddresses.$inferInsert;
export type Person = typeof people.$inferSelect;
export type NewPerson = typeof people.$inferInsert;
export type Company = typeof companies.$inferSelect;
export type NewCompany = typeof companies.$inferInsert;

export type Parcel = typeof parcels.$inferSelect;
export type NewParcel = typeof parcels.$inferInsert;
export type Property = typeof properties.$inferSelect;
export type NewProperty = typeof properties.$inferInsert;
export type Ownership = typeof ownerships.$inferSelect;
export type NewOwnership = typeof ownerships.$inferInsert;
export type Tax = typeof taxes.$inferSelect;
export type NewTax = typeof taxes.$inferInsert;
export type SalesHistory = typeof salesHistories.$inferSelect;
export type NewSalesHistory = typeof salesHistories.$inferInsert;
export type PropertyValuation = typeof propertyValuations.$inferSelect;
export type NewPropertyValuation = typeof propertyValuations.$inferInsert;
export type FactSheet = typeof factSheets.$inferSelect;
export type NewFactSheet = typeof factSheets.$inferInsert;
export type Geometry = typeof geometries.$inferSelect;
export type NewGeometry = typeof geometries.$inferInsert;
export type Deed = typeof deeds.$inferSelect;
export type NewDeed = typeof deeds.$inferInsert;
export type FileRecord = typeof files.$inferSelect;
export type NewFileRecord = typeof files.$inferInsert;
export type Structure = typeof structures.$inferSelect;
export type NewStructure = typeof structures.$inferInsert;
export type FloodStormInformation = typeof floodStormInformation.$inferSelect;
export type NewFloodStormInformation = typeof floodStormInformation.$inferInsert;
export type Utility = typeof utilities.$inferSelect;
export type NewUtility = typeof utilities.$inferInsert;
export type Layout = typeof layouts.$inferSelect;
export type NewLayout = typeof layouts.$inferInsert;
export type Lot = typeof lots.$inferSelect;
export type NewLot = typeof lots.$inferInsert;

export type PropertyImprovement = typeof propertyImprovements.$inferSelect;
export type NewPropertyImprovement = typeof propertyImprovements.$inferInsert;
export type Inspection = typeof inspections.$inferSelect;
export type NewInspection = typeof inspections.$inferInsert;
export type PermitContact = typeof permitContacts.$inferSelect;
export type NewPermitContact = typeof permitContacts.$inferInsert;
export type PermitEvent = typeof permitEvents.$inferSelect;
export type NewPermitEvent = typeof permitEvents.$inferInsert;
export type PermitFee = typeof permitFees.$inferSelect;
export type NewPermitFee = typeof permitFees.$inferInsert;
export type PermitLink = typeof permitLinks.$inferSelect;
export type NewPermitLink = typeof permitLinks.$inferInsert;
export type PermitCustomField = typeof permitCustomFields.$inferSelect;
export type NewPermitCustomField = typeof permitCustomFields.$inferInsert;
export type PermitListWindow = typeof permitListWindows.$inferSelect;
export type NewPermitListWindow = typeof permitListWindows.$inferInsert;

export type BusinessRegistration = typeof businessRegistrations.$inferSelect;
export type NewBusinessRegistration = typeof businessRegistrations.$inferInsert;
export type BusinessRegistrationAddress = typeof businessRegistrationAddresses.$inferSelect;
export type NewBusinessRegistrationAddress = typeof businessRegistrationAddresses.$inferInsert;
export type BusinessRegistrationParty = typeof businessRegistrationParties.$inferSelect;
export type NewBusinessRegistrationParty = typeof businessRegistrationParties.$inferInsert;
export type BusinessRegistrationAnnualReport =
  typeof businessRegistrationAnnualReports.$inferSelect;
export type NewBusinessRegistrationAnnualReport =
  typeof businessRegistrationAnnualReports.$inferInsert;
export type BusinessRegistrationEvent = typeof businessRegistrationEvents.$inferSelect;
export type NewBusinessRegistrationEvent = typeof businessRegistrationEvents.$inferInsert;
export type SunbizExtractionChunk = typeof sunbizExtractionChunks.$inferSelect;
export type NewSunbizExtractionChunk = typeof sunbizExtractionChunks.$inferInsert;

export type BusinessReputationProfile = typeof businessReputationProfiles.$inferSelect;
export type NewBusinessReputationProfile = typeof businessReputationProfiles.$inferInsert;
export type BusinessReputationReview = typeof businessReputationReviews.$inferSelect;
export type NewBusinessReputationReview = typeof businessReputationReviews.$inferInsert;
export type BusinessReputationComplaint = typeof businessReputationComplaints.$inferSelect;
export type NewBusinessReputationComplaint = typeof businessReputationComplaints.$inferInsert;
export type BusinessReputationComplaintEvent =
  typeof businessReputationComplaintEvents.$inferSelect;
export type NewBusinessReputationComplaintEvent =
  typeof businessReputationComplaintEvents.$inferInsert;
export type ContractorQualityScore = typeof contractorQualityScores.$inferSelect;
export type NewContractorQualityScore = typeof contractorQualityScores.$inferInsert;

export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
export type Occupancy = typeof occupancies.$inferSelect;
export type NewOccupancy = typeof occupancies.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type ProjectPermit = typeof projectPermits.$inferSelect;
export type NewProjectPermit = typeof projectPermits.$inferInsert;
export type ProjectContractor = typeof projectContractors.$inferSelect;
export type NewProjectContractor = typeof projectContractors.$inferInsert;
export type PublicRecord = typeof publicRecords.$inferSelect;
export type NewPublicRecord = typeof publicRecords.$inferInsert;
export type PropertySignalRollup = typeof propertySignalRollups.$inferSelect;
export type NewPropertySignalRollup = typeof propertySignalRollups.$inferInsert;
export type EntityDocument = typeof entityDocuments.$inferSelect;
export type NewEntityDocument = typeof entityDocuments.$inferInsert;
