import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import {
  createdAtColumn,
  jsonObjectColumn,
  sourceMetadataColumns,
} from "./shared";

export const publicRecords = pgTable(
  "public_records",
  {
    publicRecordId: uuid("public_record_id").primaryKey().defaultRandom(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    sourceUrl: text("source_url"),
    collectionTimestamp: timestamp("collection_timestamp", { withTimezone: true }),
    refreshTimestamp: timestamp("refresh_timestamp", { withTimezone: true }),
    lineage: jsonObjectColumn("lineage"),
    sourcePayload: jsonObjectColumn("source_payload"),
    ...sourceMetadataColumns(),
    createdAt: createdAtColumn(),
  },
  (table) => [
    uniqueIndex("public_records_source_record_idx").on(
      table.sourceSystem,
      table.sourceRecordKey,
    ),
    index("public_records_entity_idx").on(table.entityType, table.entityId),
    index("public_records_source_system_idx").on(table.sourceSystem),
    index("public_records_collection_ts_idx").on(table.collectionTimestamp),
  ],
);
