#!/usr/bin/env node
"use strict";

const path = require("path");
const { createRequire } = require("module");
const {
  RAG_TABLE_NAME,
  DEFAULT_RAG_EMBEDDING_MODEL,
  DEFAULT_RAG_ANSWER_MODEL,
  DEFAULT_RAG_TOP_K,
  RAG_EMBEDDING_DIMENSIONS
} = require("./rag-documents.js");

const root = path.join(__dirname, "..");
const requireFromDataSource = createRequire(path.join(root, "packages/oracle-data-source/package.json"));

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, skipped: false, resource: RAG_TABLE_NAME, message: messageOf(error) }, null, 2));
  process.exit(1);
});

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  const apiKey = process.env.OPENAI_API_KEY;
  const required = process.argv.includes("--required") || process.env.REQUIRE_RAG === "1";
  const embeddingModel = process.env.ORACLE_RAG_EMBEDDING_MODEL || DEFAULT_RAG_EMBEDDING_MODEL;
  const answerModel = process.env.ORACLE_RAG_ANSWER_MODEL || DEFAULT_RAG_ANSWER_MODEL;

  if (!databaseUrl || !apiKey) {
    const missing = [!databaseUrl ? "DATABASE_URL" : null, !apiKey ? "OPENAI_API_KEY" : null].filter(Boolean);
    const message = `${missing.join(" and ")} ${missing.length === 1 ? "is" : "are"} not set. Skipping RAG validation.`;
    if (required) {
      console.error(JSON.stringify({ ok: false, skipped: false, required: true, message }, null, 2));
      process.exit(1);
    }
    console.log(JSON.stringify({ ok: true, skipped: true, required: false, message }, null, 2));
    return;
  }

  const { neon } = requireFromDataSource("@neondatabase/serverless");
  const sql = neon(databaseUrl);
  const checks = [];
  checks.push(await extensionCheck(sql));
  checks.push(await tableCheck(sql));
  checks.push(...(await columnChecks(sql)));
  checks.push(await dimensionCheck(sql));
  checks.push(await rowCountCheck(sql));

  const missing = checks.filter((check) => !check.ok).map((check) => check.name);
  if (missing.length) {
    console.log(JSON.stringify({ ok: false, skipped: false, resource: RAG_TABLE_NAME, checks, missing }, null, 2));
    process.exit(1);
  }

  const query = "Which properties appear likely to be undergoing redevelopment?";
  const queryEmbedding = (await createEmbeddings(apiKey, embeddingModel, [query]))[0];
  const vector = vectorLiteral(queryEmbedding);
  const rows = await sql`
    select id, entity_type, entity_id, title, content, citations,
           1 - (embedding <=> ${vector}::vector) as score
    from oracle_rag_documents
    where embedding is not null
    order by embedding <=> ${vector}::vector
    limit ${DEFAULT_RAG_TOP_K}
  `;

  if (!rows.length) throw new Error("Semantic retrieval returned no rows from oracle_rag_documents.");
  const answer = await synthesize(apiKey, answerModel, query, rows.slice(0, 4));
  if (!answer || !/\[R\d+\]/.test(answer)) {
    throw new Error("LLM response did not include a retrieved chunk citation such as [R1].");
  }

  console.log(JSON.stringify({
    ok: true,
    skipped: false,
    resource: RAG_TABLE_NAME,
    embeddingModel,
    answerModel,
    checks,
    retrieved: rows.map((row) => ({ id: row.id, title: row.title, score: Number(row.score) })),
    answer
  }, null, 2));
}

async function extensionCheck(sql) {
  try {
    const rows = await sql`select count(*)::int as count from pg_extension where extname = 'vector'`;
    const count = numberValue(rows[0]?.count);
    return { name: "pgvector extension", kind: "extension", ok: count > 0, count };
  } catch (error) {
    return { name: "pgvector extension", kind: "extension", ok: false, message: messageOf(error) };
  }
}

async function tableCheck(sql) {
  try {
    const rows = await sql`
      select count(*)::int as count
      from information_schema.tables
      where table_schema = 'public' and table_name = ${RAG_TABLE_NAME}
    `;
    const count = numberValue(rows[0]?.count);
    return { name: RAG_TABLE_NAME, kind: "table", ok: count > 0, count };
  } catch (error) {
    return { name: RAG_TABLE_NAME, kind: "table", ok: false, message: messageOf(error) };
  }
}

async function columnChecks(sql) {
  const columns = ["id", "entity_type", "entity_id", "title", "content", "content_hash", "source_systems", "citations", "metadata", "embedding", "embedding_model"];
  return Promise.all(columns.map(async (column) => {
    try {
      const rows = await sql`
        select data_type, udt_name
        from information_schema.columns
        where table_schema = 'public' and table_name = ${RAG_TABLE_NAME} and column_name = ${column}
      `;
      return { name: `${RAG_TABLE_NAME}.${column}`, kind: "column", ok: rows.length > 0, type: rows[0]?.udt_name || rows[0]?.data_type };
    } catch (error) {
      return { name: `${RAG_TABLE_NAME}.${column}`, kind: "column", ok: false, message: messageOf(error) };
    }
  }));
}

async function dimensionCheck(sql) {
  try {
    const rows = await sql`select vector_dims(embedding)::int as dimensions from oracle_rag_documents where embedding is not null limit 1`;
    const dimensions = numberValue(rows[0]?.dimensions);
    return { name: "embedding dimensions", kind: "vector", ok: dimensions === RAG_EMBEDDING_DIMENSIONS, dimensions };
  } catch (error) {
    return { name: "embedding dimensions", kind: "vector", ok: false, message: messageOf(error) };
  }
}

async function rowCountCheck(sql) {
  try {
    const rows = await sql`select count(*)::int as count from oracle_rag_documents where embedding is not null`;
    const count = numberValue(rows[0]?.count);
    return { name: "embedded row count", kind: "row_count", ok: count > 0, count };
  } catch (error) {
    return { name: "embedded row count", kind: "row_count", ok: false, message: messageOf(error) };
  }
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
  return (json.data || []).map((item) => item.embedding);
}

async function synthesize(apiKey, model, query, rows) {
  const evidence = rows.map((row, index) => `[R${index + 1}] ${row.title} (${row.entity_type}:${row.entity_id})\n${row.content}`).join("\n\n");
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      reasoning: { effort: "low" },
      instructions: "Answer only from the retrieved evidence and cite chunks with labels like [R1].",
      input: `Question: ${query}\n\nRetrieved evidence:\n${evidence}`
    })
  });
  if (!response.ok) throw new Error(await response.text());
  const json = await response.json();
  return json.output_text || (json.output || []).flatMap((item) => item.content || []).map((item) => item.text).filter(Boolean).join("\n");
}

function vectorLiteral(values) {
  return `[${values.map((value) => Number(value).toFixed(8)).join(",")}]`;
}

function numberValue(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function messageOf(error) {
  return error instanceof Error ? error.message : String(error);
}
