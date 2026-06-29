import {
  index,
  integer,
  numeric,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { parcels, properties } from "./appraisal";
import {
  createdAtColumn,
  emptyTextArray,
  jsonObjectColumn,
  sourceMetadataColumns,
  updatedAtColumn,
} from "./shared";

export const propertySignalRollups = pgTable(
  "property_signal_rollups",
  {
    propertySignalRollupId: uuid("property_signal_rollup_id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id").references(() => properties.propertyId, {
      onDelete: "cascade",
    }),
    parcelId: uuid("parcel_id").references(() => parcels.parcelId, {
      onDelete: "set null",
    }),
    parcelIdentifier: text("parcel_identifier"),
    municipalityName: text("municipality_name"),
    subdivision: text("subdivision"),
    openPermitCount: integer("open_permit_count").notNull().default(0),
    openPermitCategories: text("open_permit_categories").array().notNull().default(emptyTextArray),
    permitCount5y: integer("permit_count_5y").notNull().default(0),
    majorRenovationCount: integer("major_renovation_count").notNull().default(0),
    renovationTrades: text("renovation_trades").array().notNull().default(emptyTextArray),
    improvementScore: numeric("improvement_score", { precision: 10, scale: 2 })
      .notNull()
      .default("0"),
    ownershipChangeCount: integer("ownership_change_count").notNull().default(0),
    businessTurnoverCount: integer("business_turnover_count").notNull().default(0),
    totalPermitValue: numeric("total_permit_value", { precision: 18, scale: 2 })
      .notNull()
      .default("0"),
    factorPayload: jsonObjectColumn("factor_payload"),
    sourcePayload: jsonObjectColumn("source_payload"),
    ...sourceMetadataColumns(),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [
    uniqueIndex("property_signal_rollups_source_record_idx").on(
      table.sourceSystem,
      table.sourceRecordKey,
    ),
    uniqueIndex("property_signal_rollups_property_idx").on(table.propertyId),
    index("property_signal_rollups_open_permit_idx").on(table.openPermitCount),
    index("property_signal_rollups_permit5y_idx").on(table.permitCount5y),
    index("property_signal_rollups_major_idx").on(table.majorRenovationCount),
    index("property_signal_rollups_score_idx").on(table.improvementScore),
    index("property_signal_rollups_municipality_idx").on(table.municipalityName),
  ],
);
