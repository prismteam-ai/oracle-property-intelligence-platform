import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  uniqueIndex,
  uuid,
  vector,
} from "drizzle-orm/pg-core";

import {
  createdAtColumn,
  emptyJsonObject,
  emptyTextArray,
  jsonObjectColumn,
  sourceMetadataColumns,
  updatedAtColumn,
} from "./shared";

export const EMBEDDING_DIM = 1024;

export const entityDocuments = pgTable(
  "entity_documents",
  {
    documentId: uuid("document_id").primaryKey().defaultRandom(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id"),
    title: text("title").notNull(),
    subtitle: text("subtitle"),
    body: text("body").notNull(),
    metadata: jsonObjectColumn("metadata"),
    sourceSystems: text("source_systems").array().notNull().default(emptyTextArray),
    citations: jsonObjectColumn("citations").default(emptyJsonObject),
    embedding: vector("embedding", { dimensions: EMBEDDING_DIM }),
    corpusType: text("corpus_type"),
    sourceUri: text("source_uri"),
    sourceHash: text("source_hash"),
    version: integer("version").notNull().default(1),
    embeddingModel: text("embedding_model"),
    embeddingDim: integer("embedding_dim").notNull().default(EMBEDDING_DIM),
    reviewed: boolean("reviewed").notNull().default(false),
    searchVector: text("search_vector"),
    sourcePayload: jsonObjectColumn("source_payload"),
    ...sourceMetadataColumns(),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [
    uniqueIndex("entity_documents_source_record_idx").on(
      table.sourceSystem,
      table.sourceRecordKey,
    ),
    index("entity_documents_entity_idx").on(table.entityType, table.entityId),
    index("entity_documents_corpus_type_idx").on(table.corpusType),
    index("entity_documents_fts_idx").using(
      "gin",
      sql`to_tsvector('english', coalesce(${table.title}, '') || ' ' || coalesce(${table.body}, ''))`,
    ),
  ],
);
