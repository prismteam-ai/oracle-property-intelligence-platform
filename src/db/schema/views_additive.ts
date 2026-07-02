import { sql } from "drizzle-orm";
import { date, integer, numeric, pgView, text, uuid } from "drizzle-orm/pg-core";

import { companies } from "./core";
import {
  businessReputationProfiles,
  contractorQualityScores,
} from "./bbb";
import { tenants } from "./tenancy";
import { projects } from "./projects";
import { propertySignalRollups } from "./analytics";

export const contractorProfileView = pgView("contractor_profile_view", {
  companyId: uuid("company_id"),
  name: text("name"),
  normalizedName: text("normalized_name"),
  businessReputationProfileId: uuid("business_reputation_profile_id"),
  bbbRating: text("bbb_rating"),
  ratingScore: numeric("rating_score", { precision: 6, scale: 2 }),
  reviewAverageRating: numeric("review_average_rating", { precision: 5, scale: 2 }),
  reviewCount: integer("review_count"),
  complaintCount: integer("complaint_count"),
  qualityScore: numeric("quality_score", { precision: 6, scale: 2 }),
  scoreBand: text("score_band"),
}).as(sql`
  select
    ${companies.companyId} as company_id,
    ${companies.name} as name,
    ${companies.normalizedName} as normalized_name,
    ${businessReputationProfiles.businessReputationProfileId} as business_reputation_profile_id,
    ${businessReputationProfiles.bbbRating} as bbb_rating,
    ${businessReputationProfiles.ratingScore} as rating_score,
    ${businessReputationProfiles.reviewAverageRating} as review_average_rating,
    ${businessReputationProfiles.reviewCount} as review_count,
    ${businessReputationProfiles.complaintCount} as complaint_count,
    ${contractorQualityScores.score} as quality_score,
    ${contractorQualityScores.scoreBand} as score_band
  from ${companies}
  left join ${businessReputationProfiles}
    on ${businessReputationProfiles.companyId} = ${companies.companyId}
  left join ${contractorQualityScores}
    on ${contractorQualityScores.companyId} = ${companies.companyId}
`);

export const tenantProfileView = pgView("tenant_profile_view", {
  tenantId: uuid("tenant_id"),
  tenantName: text("tenant_name"),
  normalizedName: text("normalized_name"),
  tenantType: text("tenant_type"),
  personId: uuid("person_id"),
  companyId: uuid("company_id"),
}).as(sql`
  select
    ${tenants.tenantId} as tenant_id,
    ${tenants.tenantName} as tenant_name,
    ${tenants.normalizedName} as normalized_name,
    ${tenants.tenantType} as tenant_type,
    ${tenants.personId} as person_id,
    ${tenants.companyId} as company_id
  from ${tenants}
`);

export const projectView = pgView("project_view", {
  projectId: uuid("project_id"),
  propertyId: uuid("property_id"),
  parcelId: uuid("parcel_id"),
  projectName: text("project_name"),
  projectStatus: text("project_status"),
  projectType: text("project_type"),
  isMajorRenovation: integer("is_major_renovation"),
  permitCount: integer("permit_count"),
  totalEstimatedValue: numeric("total_estimated_value", { precision: 18, scale: 2 }),
  completionDate: date("completion_date"),
}).as(sql`
  select
    ${projects.projectId} as project_id,
    ${projects.propertyId} as property_id,
    ${projects.parcelId} as parcel_id,
    ${projects.projectName} as project_name,
    ${projects.projectStatus} as project_status,
    ${projects.projectType} as project_type,
    ${projects.isMajorRenovation} as is_major_renovation,
    ${projects.permitCount} as permit_count,
    ${projects.totalEstimatedValue} as total_estimated_value,
    ${projects.completionDate} as completion_date
  from ${projects}
`);

export const propertySignalView = pgView("property_signal_view", {
  propertyId: uuid("property_id"),
  parcelIdentifier: text("parcel_identifier"),
  municipalityName: text("municipality_name"),
  subdivision: text("subdivision"),
  openPermitCount: integer("open_permit_count"),
  permitCount5y: integer("permit_count_5y"),
  majorRenovationCount: integer("major_renovation_count"),
  improvementScore: numeric("improvement_score", { precision: 10, scale: 2 }),
  ownershipChangeCount: integer("ownership_change_count"),
  businessTurnoverCount: integer("business_turnover_count"),
}).as(sql`
  select
    ${propertySignalRollups.propertyId} as property_id,
    ${propertySignalRollups.parcelIdentifier} as parcel_identifier,
    ${propertySignalRollups.municipalityName} as municipality_name,
    ${propertySignalRollups.subdivision} as subdivision,
    ${propertySignalRollups.openPermitCount} as open_permit_count,
    ${propertySignalRollups.permitCount5y} as permit_count_5y,
    ${propertySignalRollups.majorRenovationCount} as major_renovation_count,
    ${propertySignalRollups.improvementScore} as improvement_score,
    ${propertySignalRollups.ownershipChangeCount} as ownership_change_count,
    ${propertySignalRollups.businessTurnoverCount} as business_turnover_count
  from ${propertySignalRollups}
`);
