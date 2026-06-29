import {
  date,
  index,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { addresses, companies, people } from "./core";
import { properties } from "./appraisal";
import { businessRegistrations } from "./sunbiz";
import {
  createdAtColumn,
  jsonObjectColumn,
  sourceMetadataColumns,
  updatedAtColumn,
} from "./shared";

export const tenants = pgTable(
  "tenants",
  {
    tenantId: uuid("tenant_id").primaryKey().defaultRandom(),
    personId: uuid("person_id").references(() => people.personId, {
      onDelete: "set null",
    }),
    companyId: uuid("company_id").references(() => companies.companyId, {
      onDelete: "set null",
    }),
    requestIdentifier: text("request_identifier"),
    tenantName: text("tenant_name"),
    normalizedName: text("normalized_name"),
    tenantType: text("tenant_type"),
    matchMethod: text("match_method"),
    matchConfidence: text("match_confidence"),
    sourcePayload: jsonObjectColumn("source_payload"),
    ...sourceMetadataColumns(),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [
    uniqueIndex("tenants_source_record_idx").on(table.sourceSystem, table.sourceRecordKey),
    index("tenants_person_idx").on(table.personId),
    index("tenants_company_idx").on(table.companyId),
    index("tenants_normalized_name_idx").on(table.normalizedName),
  ],
);

export const occupancies = pgTable(
  "occupancies",
  {
    occupancyId: uuid("occupancy_id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").references(() => tenants.tenantId, {
      onDelete: "cascade",
    }),
    propertyId: uuid("property_id").references(() => properties.propertyId, {
      onDelete: "set null",
    }),
    addressId: uuid("address_id").references(() => addresses.addressId, {
      onDelete: "set null",
    }),
    businessRegistrationId: uuid("business_registration_id").references(
      () => businessRegistrations.businessRegistrationId,
      { onDelete: "set null" },
    ),
    companyId: uuid("company_id").references(() => companies.companyId, {
      onDelete: "set null",
    }),
    requestIdentifier: text("request_identifier"),
    occupancyType: text("occupancy_type"),
    occupancyStatus: text("occupancy_status"),
    spaceIdentifier: text("space_identifier"),
    startDate: date("start_date"),
    endDate: date("end_date"),
    matchMethod: text("match_method"),
    matchConfidence: text("match_confidence"),
    sourcePayload: jsonObjectColumn("source_payload"),
    ...sourceMetadataColumns(),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [
    uniqueIndex("occupancies_source_record_idx").on(table.sourceSystem, table.sourceRecordKey),
    index("occupancies_tenant_idx").on(table.tenantId),
    index("occupancies_property_idx").on(table.propertyId),
    index("occupancies_address_idx").on(table.addressId),
    index("occupancies_business_registration_idx").on(table.businessRegistrationId),
    index("occupancies_company_idx").on(table.companyId),
    index("occupancies_status_idx").on(table.occupancyStatus),
    index("occupancies_dates_idx").on(table.startDate, table.endDate),
  ],
);
