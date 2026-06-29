import {
  date,
  index,
  integer,
  numeric,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { companies } from "./core";
import { parcels, properties } from "./appraisal";
import { propertyImprovements } from "./permits";
import {
  createdAtColumn,
  emptyTextArray,
  jsonObjectColumn,
  sourceMetadataColumns,
  updatedAtColumn,
} from "./shared";

export const projects = pgTable(
  "projects",
  {
    projectId: uuid("project_id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id").references(() => properties.propertyId, {
      onDelete: "set null",
    }),
    parcelId: uuid("parcel_id").references(() => parcels.parcelId, {
      onDelete: "set null",
    }),
    requestIdentifier: text("request_identifier"),
    projectName: text("project_name"),
    projectDescription: text("project_description"),
    projectStatus: text("project_status"),
    projectType: text("project_type"),
    isMajorRenovation: integer("is_major_renovation"),
    renovationTrades: text("renovation_trades").array().notNull().default(emptyTextArray),
    permitCount: integer("permit_count"),
    totalEstimatedValue: numeric("total_estimated_value", { precision: 18, scale: 2 }),
    startDate: date("start_date"),
    endDate: date("end_date"),
    completionDate: date("completion_date"),
    sourcePayload: jsonObjectColumn("source_payload"),
    ...sourceMetadataColumns(),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [
    uniqueIndex("projects_source_record_idx").on(table.sourceSystem, table.sourceRecordKey),
    index("projects_property_idx").on(table.propertyId),
    index("projects_parcel_idx").on(table.parcelId),
    index("projects_status_idx").on(table.projectStatus),
    index("projects_major_idx").on(table.isMajorRenovation),
  ],
);

export const projectPermits = pgTable(
  "project_permits",
  {
    projectPermitId: uuid("project_permit_id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.projectId, { onDelete: "cascade" }),
    propertyImprovementId: uuid("property_improvement_id")
      .notNull()
      .references(() => propertyImprovements.propertyImprovementId, { onDelete: "cascade" }),
    sourcePayload: jsonObjectColumn("source_payload"),
    ...sourceMetadataColumns(),
    createdAt: createdAtColumn(),
  },
  (table) => [
    uniqueIndex("project_permits_source_record_idx").on(table.sourceSystem, table.sourceRecordKey),
    uniqueIndex("project_permits_unique_idx").on(
      table.projectId,
      table.propertyImprovementId,
    ),
    index("project_permits_permit_idx").on(table.propertyImprovementId),
  ],
);

export const projectContractors = pgTable(
  "project_contractors",
  {
    projectContractorId: uuid("project_contractor_id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.projectId, { onDelete: "cascade" }),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.companyId, { onDelete: "cascade" }),
    contractorRole: text("contractor_role"),
    sourcePayload: jsonObjectColumn("source_payload"),
    ...sourceMetadataColumns(),
    createdAt: createdAtColumn(),
  },
  (table) => [
    uniqueIndex("project_contractors_source_record_idx").on(
      table.sourceSystem,
      table.sourceRecordKey,
    ),
    uniqueIndex("project_contractors_unique_idx").on(table.projectId, table.companyId),
    index("project_contractors_company_idx").on(table.companyId),
  ],
);
