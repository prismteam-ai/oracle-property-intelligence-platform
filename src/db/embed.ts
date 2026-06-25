/**
 * Builds embeddings for the RAG corpus: pulls every entity_document, embeds
 * (title + subtitle + body) via the local fastembed service, writes the vectors,
 * and creates an HNSW cosine index for fast semantic retrieval.
 *
 * Run: node --env-file=.env.local --import tsx src/db/embed.ts
 */
import { sql } from "./client";

const URL = process.env.EMBEDDINGS_URL || "http://127.0.0.1:8900";

async function embed(texts: string[]): Promise<number[][]> {
  const res = await fetch(`${URL}/embed`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ texts }), signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`embed service ${res.status}`);
  return (await res.json()).embeddings;
}

async function main() {
  const health = await fetch(`${URL}/health`).then((r) => r.json()).catch(() => null);
  if (!health) {
    console.error(`Embeddings service not reachable at ${URL}. Start it (docker run … oracle-embeddings) and retry.`);
    process.exit(1);
  }
  console.log(`embeddings service ok: ${health.model} (${health.dim}d)`);

  const rows = (await sql`
    select document_id, title, coalesce(subtitle,'') as subtitle, body
    from entity_documents where embedding is null order by document_id`) as any[];
  console.log(`embedding ${rows.length} documents…`);

  const BATCH = 128;
  let done = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const texts = chunk.map((r) => `${r.title}. ${r.subtitle}. ${r.body}`.slice(0, 1600));
    const vecs = await embed(texts);
    const ids = chunk.map((r) => r.document_id);
    const lits = vecs.map((v) => `[${v.join(",")}]`);
    await sql`
      update entity_documents as e set embedding = v.emb::vector
      from (select unnest(${ids}::uuid[]) as id, unnest(${lits}::text[]) as emb) v
      where e.document_id = v.id`;
    done += chunk.length;
    if (done % 512 === 0 || done === rows.length) console.log(`  ${done}/${rows.length}`);
  }

  console.log("creating HNSW index…");
  await sql.unsafe(`CREATE INDEX IF NOT EXISTS entdoc_embedding_hnsw ON entity_documents USING hnsw (embedding vector_cosine_ops)`);

  const [{ n }] = (await sql`select count(*)::int as n from entity_documents where embedding is not null`) as any[];
  console.log(`✅ embedded ${n} documents.`);
  await sql.end();
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
