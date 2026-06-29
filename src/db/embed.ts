import { sql } from "drizzle-orm";

import { db } from "@/server/pg";
import { entityDocuments } from "@/db/schema";
import { getEmbeddingService } from "@/server/rag/embed-client";

const BATCH = Number(process.env.EMBED_BATCH ?? 64);

async function reconcileColumnDimension(dim: number, model: string): Promise<void> {
  if (!Number.isInteger(dim) || dim <= 0) {
    throw new Error(
      `[oracle] embedding dimension must be a positive integer for vector(n) DDL, got ${dim}`,
    );
  }
  await db.execute(sql`drop index if exists entity_documents_embedding_hnsw_idx`);
  await db.execute(sql`
    update ${entityDocuments}
    set embedding = null
    where ${entityDocuments.embeddingModel} is distinct from ${model}
  `);
  await db.execute(sql`
    alter table entity_documents
    alter column embedding type vector(${sql.raw(String(dim))})
    using null
  `);
}

export async function embedAll(): Promise<number> {
  const svc = getEmbeddingService();
  let total = 0;

  await reconcileColumnDimension(svc.dim, svc.model);

  for (;;) {
    const rows = await db
      .select({
        documentId: entityDocuments.documentId,
        title: entityDocuments.title,
        body: entityDocuments.body,
      })
      .from(entityDocuments)
      .where(sql`${entityDocuments.embedding} is null`)
      .limit(BATCH);

    if (rows.length === 0) break;

    const inputs = rows.map((r) => `${r.title}\n${r.body}`);
    const vectors = svc.embedConcurrent
      ? await svc.embedConcurrent(inputs)
      : await svc.embed(inputs);
    const values = rows
      .map((r, i) => {
        const vec = vectors[i];
        if (!vec) return null;
        return sql`(${r.documentId}::uuid, ${`[${vec.join(",")}]`}::vector)`;
      })
      .filter((v): v is ReturnType<typeof sql> => v !== null);
    if (values.length === 0) {
      total += rows.length;
      continue;
    }
    await db.execute(sql`
      update ${entityDocuments} as ed
      set embedding = v.vec,
          embedding_model = ${svc.model},
          embedding_dim = ${svc.dim},
          updated_at = now()
      from (values ${sql.join(values, sql`, `)}) as v(document_id, vec)
      where ed.document_id = v.document_id
    `);
    total += rows.length;
    if (total % 512 === 0 || rows.length < BATCH) {
      console.log(`  embedded ${total} documents...`);
    }
  }

  await db.execute(sql`
    create index if not exists entity_documents_embedding_hnsw_idx
    on entity_documents using hnsw (embedding vector_cosine_ops)
  `);

  return total;
}

const isMain =
  typeof process !== "undefined" &&
  process.argv[1] &&
  process.argv[1].endsWith("embed.ts");
if (isMain) {
  embedAll()
    .then((n) => {
      console.log(`Embedded ${n} documents; HNSW index ensured.`);
      process.exit(0);
    })
    .catch((err) => {
      console.error("Embed failed:", err);
      process.exit(1);
    });
}
