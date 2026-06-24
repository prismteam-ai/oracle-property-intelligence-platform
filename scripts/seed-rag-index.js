#!/usr/bin/env node
"use strict";

const path = require("path");
const { createRequire } = require("module");
const {
  RAG_TABLE_NAME,
  DEFAULT_RAG_EMBEDDING_MODEL,
  buildOracleRagDocuments,
  loadOracleData
} = require("./rag-documents.js");

const root = path.join(__dirname, "..");
const requireFromDataSource = createRequire(path.join(root, "packages/oracle-data-source/package.json"));

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, resource: RAG_TABLE_NAME, message: messageOf(error) }, null, 2));
  process.exit(1);
});

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  const apiKey = process.env.OPENAI_API_KEY;
  const embeddingModel = process.env.ORACLE_RAG_EMBEDDING_MODEL || DEFAULT_RAG_EMBEDDING_MODEL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required for Neon pgvector RAG seeding.");
  if (!apiKey) throw new Error("OPENAI_API_KEY is required for OpenAI embedding generation.");

  const data = loadOracleData();
  const documents = buildOracleRagDocuments(data);
  const { neon } = requireFromDataSource("@neondatabase/serverless");
  const sql = neon(databaseUrl);

  await ensureSchema(sql);
  if (process.argv.includes("--reset")) {
    await sql(`truncate table ${RAG_TABLE_NAME}`);
  }

  const existingRows = await sql(`select id, content_hash, embedding_model from ${RAG_TABLE_NAME}`);
  const existing = new Map(existingRows.map((row) => [row.id, row]));
  const changed = documents.filter((doc) => {
    const row = existing.get(doc.id);
    return !row || row.content_hash !== doc.contentHash || row.embedding_model !== embeddingModel;
  });

  let embedded = 0;
  for (const batch of chunks(changed, 32)) {
    const embeddings = await createEmbeddings(apiKey, embeddingModel, batch.map((doc) => doc.content));
    for (let index = 0; index < batch.length; index += 1) {
      await upsertDocument(sql, batch[index], embeddings[index], embeddingModel);
      embedded += 1;
    }
  }

  const countRows = await sql(`select count(*)::int as count from ${RAG_TABLE_NAME}`);
  console.log(JSON.stringify({
    ok: true,
    resource: RAG_TABLE_NAME,
    embeddingModel,
    documents: documents.length,
    embedded,
    skipped: documents.length - embedded,
    rows: numberValue(countRows[0]?.count)
  }, null, 2));
}

async function ensureSchema(sql) {
  await sql`create extension if not exists vector`;
  await sql`
    create table if not exists oracle_rag_documents (
      id text primary key,
      entity_type text not null,
      entity_id text not null,
      title text not null,
      content text not null,
      content_hash text not null,
      source_systems jsonb not null default '[]'::jsonb,
      citations jsonb not null default '[]'::jsonb,
      metadata jsonb not null default '{}'::jsonb,
      embedding vector(1536),
      embedding_model text,
      updated_at timestamptz not null default now()
    )
  `;
}

async function upsertDocument(sql, doc, embedding, embeddingModel) {
  const vector = vectorLiteral(embedding);
  await sql`
    insert into oracle_rag_documents (
      id, entity_type, entity_id, title, content, content_hash,
      source_systems, citations, metadata, embedding, embedding_model, updated_at
    )
    values (
      ${doc.id}, ${doc.entityType}, ${doc.entityId}, ${doc.title}, ${doc.content}, ${doc.contentHash},
      ${JSON.stringify(doc.sourceSystems)}::jsonb, ${JSON.stringify(doc.citations)}::jsonb, ${JSON.stringify(doc.metadata || {})}::jsonb,
      ${vector}::vector, ${embeddingModel}, now()
    )
    on conflict (id) do update set
      entity_type = excluded.entity_type,
      entity_id = excluded.entity_id,
      title = excluded.title,
      content = excluded.content,
      content_hash = excluded.content_hash,
      source_systems = excluded.source_systems,
      citations = excluded.citations,
      metadata = excluded.metadata,
      embedding = excluded.embedding,
      embedding_model = excluded.embedding_model,
      updated_at = now()
  `;
}

async function createEmbeddings(apiKey, model, inputs) {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({ model, input: inputs, encoding_format: "float" })
  });
  if (!response.ok) throw new Error(await response.text());
  const json = await response.json();
  const embeddings = (json.data || []).map((item) => item.embedding);
  if (embeddings.length !== inputs.length) {
    throw new Error(`Expected ${inputs.length} embeddings, received ${embeddings.length}.`);
  }
  return embeddings;
}

function vectorLiteral(values) {
  return `[${values.map((value) => Number(value).toFixed(8)).join(",")}]`;
}

function chunks(items, size) {
  const out = [];
  for (let index = 0; index < items.length; index += size) out.push(items.slice(index, index + size));
  return out;
}

function numberValue(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function messageOf(error) {
  return error instanceof Error ? error.message : String(error);
}
