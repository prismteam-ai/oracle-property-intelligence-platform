import { neon } from "@neondatabase/serverless";
import {
  ORACLE_LEXICON_ENTITIES,
  ORACLE_LEXICON_RELATIONSHIPS,
  badge,
  badgeFromTone,
  bbbTone,
  isOpenPermit,
  money,
  permitTone,
  type BusinessRecord,
  type ContractorRecord,
  type EntityType,
  type InquiryResult,
  type OracleData,
  type OwnerRecord,
  type PropertyRecord,
  type ResultCard,
  type RetrievedChunk,
  type RetrievalMetadata,
  type SourceProvenance,
  type TenantRecord
} from "../../domain/src/index.js";

export const RAG_TABLE_NAME = "oracle_rag_documents";
export const DEFAULT_RAG_EMBEDDING_MODEL = "text-embedding-3-small";
export const DEFAULT_RAG_ANSWER_MODEL = "gpt-5.4-mini";
export const DEFAULT_RAG_TOP_K = 8;
export const RAG_EMBEDDING_DIMENSIONS = 1536;

export interface OracleRagEnv {
  DATABASE_URL?: string;
  OPENAI_API_KEY?: string;
  ORACLE_RAG_EMBEDDING_MODEL?: string;
  ORACLE_RAG_ANSWER_MODEL?: string;
  ORACLE_RAG_TOP_K?: string;
}

export interface OracleRagDocument {
  id: string;
  entityType: EntityType;
  entityId: string;
  title: string;
  content: string;
  contentHash: string;
  citations: SourceProvenance[];
  sourceSystems: string[];
  metadata: Record<string, string | number | boolean>;
}

export type OracleRagErrorCode =
  | "missing-database-url"
  | "missing-openai-api-key"
  | "empty-rag-index"
  | "embedding-failed"
  | "retrieval-failed"
  | "llm-failed";

export class OracleRagError extends Error {
  readonly code: OracleRagErrorCode;

  constructor(code: OracleRagErrorCode, message: string) {
    super(message);
    this.name = "OracleRagError";
    this.code = code;
  }
}

interface RagDocumentRow {
  id: string;
  entity_type: EntityType;
  entity_id: string;
  title: string;
  content: string;
  citations: SourceProvenance[] | string;
  source_systems: string[] | string;
  score: number | string;
}

type SqlClient = ReturnType<typeof neon>;

export function buildOracleRagDocuments(data: OracleData): OracleRagDocument[] {
  const docs: Omit<OracleRagDocument, "contentHash">[] = [];

  for (const property of data.properties) {
    const contractors = contractorsFor(data, property);
    const businesses = property.businesses.map((id) => data.businesses.find((business) => business.id === id)).filter(Boolean) as BusinessRecord[];
    const tenants = property.tenants.map((id) => data.tenants.find((tenant) => tenant.id === id)).filter(Boolean) as TenantRecord[];
    docs.push({
      id: `property:${property.id}`,
      entityType: "property",
      entityId: property.id,
      title: property.address,
      content: [
        `Entity: Property ${property.address}`,
        `Durable id: ${property.id}; parcel ${property.parcel}; county ${data.corpus.county}.`,
        `Location: ${property.city}; neighborhood ${property.neighborhood}; class ${property.class}; built ${property.year}.`,
        `Current owner: ${property.owner}. Ownership history: ${property.ownerHistory.map((item) => `${item.owner} ${item.type} ${item.date}`).join("; ")}.`,
        `Permits: ${property.permits.map((permit) => `${permit.id} ${permit.status} ${permit.type} ${permit.scope} ${money(permit.value)} filed ${permit.filed}${permit.major ? " major improvement" : ""}`).join("; ")}.`,
        `Contractors: ${contractors.map((contractor) => `${contractor.name} BBB ${contractor.bbb} trades ${contractor.trades.join("/")}`).join("; ") || "none linked"}.`,
        `Businesses: ${businesses.map((business) => `${business.name} ${business.btype} ${business.status}`).join("; ") || "none linked"}.`,
        `Tenants: ${tenants.map((tenant) => `${tenant.name} ${tenant.activity}`).join("; ") || "none linked"}.`,
        data.turnover[property.id] ? `Turnover signal: ${data.turnover[property.id]}.` : "Turnover signal: none in loaded corpus.",
        `Open permits: ${property.permits.filter((permit) => isOpenPermit(permit.status)).length}; major improvements: ${property.permits.filter((permit) => permit.major).length}.`
      ].join("\n"),
      citations: property.src,
      sourceSystems: sourceSystems(property.src),
      metadata: {
        county: data.corpus.county,
        city: property.city,
        neighborhood: property.neighborhood,
        class: property.class,
        permits: property.permits.length
      }
    });

    for (const permit of property.permits) {
      const contractor = data.contractors.find((item) => item.id === permit.contractor);
      docs.push({
        id: `permit:${permit.id}`,
        entityType: "property",
        entityId: property.id,
        title: `${permit.type} permit ${permit.id}`,
        content: [
          `Entity: Permit ${permit.id} for ${property.address}`,
          `Property: ${property.address}, ${property.city}; parcel ${property.parcel}.`,
          `Permit: ${permit.status} ${permit.type}; scope ${permit.scope}; value ${money(permit.value)}; filed ${permit.filed}; major ${permit.major ? "yes" : "no"}.`,
          contractor ? `Contractor: ${contractor.name}; license ${contractor.license}; BBB ${contractor.bbb}; complaints ${contractor.complaints.length}; review ${contractor.review}.` : "Contractor: not resolved.",
          `Source-backed relationship: property-has-permit and permit-performed-by-contractor.`
        ].join("\n"),
        citations: [...property.src, ...(contractor?.src ?? [])],
        sourceSystems: sourceSystems([...property.src, ...(contractor?.src ?? [])]),
        metadata: {
          county: data.corpus.county,
          propertyId: property.id,
          permitType: permit.type,
          status: permit.status,
          major: permit.major
        }
      });
    }
  }

  for (const contractor of data.contractors) {
    const projects = data.properties.flatMap((property) =>
      property.permits
        .filter((permit) => permit.contractor === contractor.id)
        .map((permit) => `${property.address}: ${permit.status} ${permit.type} ${permit.scope} ${money(permit.value)}`)
    );
    docs.push({
      id: `contractor:${contractor.id}`,
      entityType: "contractor",
      entityId: contractor.id,
      title: contractor.name,
      content: [
        `Entity: Contractor ${contractor.name}`,
        `License ${contractor.license}; county ${contractor.county}; trades ${contractor.trades.join(", ")}.`,
        `Project count ${contractor.projects}; BBB rating ${contractor.bbb}; review score ${contractor.review}; complaints ${contractor.complaints.length}.`,
        `Complaints: ${contractor.complaints.map((complaint) => `${complaint.date} ${complaint.status}: ${complaint.summary}`).join("; ") || "none"}.`,
        `Linked projects: ${projects.join("; ") || "none in loaded corpus"}.`
      ].join("\n"),
      citations: contractor.src,
      sourceSystems: sourceSystems(contractor.src),
      metadata: {
        county: contractor.county,
        bbb: contractor.bbb,
        projects: contractor.projects,
        complaints: contractor.complaints.length
      }
    });
  }

  for (const business of data.businesses) {
    const locations = business.locations.map((id) => data.properties.find((property) => property.id === id)).filter(Boolean) as PropertyRecord[];
    docs.push({
      id: `business:${business.id}`,
      entityType: "business",
      entityId: business.id,
      title: business.name,
      content: [
        `Entity: Business ${business.name}`,
        `Type ${business.btype}; Sunbiz ${business.sunbiz}; status ${business.status}; owner ${business.owner}; registered ${business.registered}.`,
        `Locations: ${locations.map((property) => `${property.address}, ${property.city}`).join("; ") || "none linked"}.`,
        `Property footprint: ${business.locations.length} location${business.locations.length === 1 ? "" : "s"}.`
      ].join("\n"),
      citations: business.src,
      sourceSystems: sourceSystems(business.src),
      metadata: {
        businessType: business.btype,
        status: business.status,
        locations: business.locations.length
      }
    });
  }

  for (const owner of data.owners) {
    const properties = owner.props.map((id) => data.properties.find((property) => property.id === id)).filter(Boolean) as PropertyRecord[];
    docs.push({
      id: `owner:${owner.id}`,
      entityType: "owner",
      entityId: owner.id,
      title: owner.name,
      content: [
        `Entity: Owner ${owner.name}`,
        `Owner type ${owner.type}; associated since ${owner.since}.`,
        `Properties: ${properties.map((property) => `${property.address}, ${property.city}, ${property.class}`).join("; ") || "none linked"}.`,
        `Property footprint: ${owner.props.length} parcel${owner.props.length === 1 ? "" : "s"}.`
      ].join("\n"),
      citations: owner.src,
      sourceSystems: sourceSystems(owner.src),
      metadata: {
        ownerType: owner.type,
        properties: owner.props.length
      }
    });
  }

  for (const tenant of data.tenants) {
    const locations = tenant.locations.map((id) => data.properties.find((property) => property.id === id)).filter(Boolean) as PropertyRecord[];
    const businesses = tenant.businesses.map((id) => data.businesses.find((business) => business.id === id)).filter(Boolean) as BusinessRecord[];
    docs.push({
      id: `tenant:${tenant.id}`,
      entityType: "tenant",
      entityId: tenant.id,
      title: tenant.name,
      content: [
        `Entity: Tenant ${tenant.name}`,
        `Tenant type ${tenant.ttype}; activity ${tenant.activity}.`,
        `Locations: ${locations.map((property) => `${property.address}, ${property.city}`).join("; ") || "none linked"}.`,
        `Associated businesses: ${businesses.map((business) => `${business.name} ${business.btype}`).join("; ") || "none linked"}.`
      ].join("\n"),
      citations: tenant.src,
      sourceSystems: sourceSystems(tenant.src),
      metadata: {
        tenantType: tenant.ttype,
        locations: tenant.locations.length,
        businesses: tenant.businesses.length
      }
    });
  }

  docs.push({
    id: "lexicon:entities-relationships",
    entityType: "graph",
    entityId: "oracle-lexicon",
    title: "Oracle Elephant Lexicon",
    content: [
      "Entity: Oracle Elephant Lexicon",
      `Canonical entities: ${ORACLE_LEXICON_ENTITIES.map((entity) => `${entity.name} durable id ${entity.durableId}`).join("; ")}.`,
      `Canonical relationships: ${ORACLE_LEXICON_RELATIONSHIPS.map((relationship) => `${relationship.id}: ${relationship.from} ${relationship.label} ${relationship.to}`).join("; ")}.`,
      "Every response must preserve source provenance, source URLs, collection timestamps, refresh timestamps, and lineage metadata."
    ].join("\n"),
    citations: data.sourceSnapshots?.map((source) => ({
      system: source.label,
      url: source.repo,
      collected: data.corpus.lastRefresh,
      refreshed: data.corpus.lastRefresh,
      entity: `${source.id}@${source.commit}`
    })) ?? [],
    sourceSystems: data.sourceSnapshots?.map((source) => source.label) ?? ["Oracle Command Center"],
    metadata: {
      entities: ORACLE_LEXICON_ENTITIES.length,
      relationships: ORACLE_LEXICON_RELATIONSHIPS.length
    }
  });

  return docs.map((doc) => ({ ...doc, contentHash: stableHash(doc.content) }));
}

export async function seedOracleRagIndex(data: OracleData, env: OracleRagEnv): Promise<{ embedded: number; skipped: number; total: number }> {
  const sql = sqlClient(env);
  const apiKey = openAiKey(env);
  const embeddingModel = env.ORACLE_RAG_EMBEDDING_MODEL || DEFAULT_RAG_EMBEDDING_MODEL;
  const documents = buildOracleRagDocuments(data);
  await ensureRagSchema(sql);

  const existingRows = await sql`select id, content_hash, embedding_model from oracle_rag_documents`;
  const existing = new Map((existingRows as Array<{ id: string; content_hash: string; embedding_model: string }>).map((row) => [row.id, row]));
  const changed = documents.filter((doc) => {
    const row = existing.get(doc.id);
    return !row || row.content_hash !== doc.contentHash || row.embedding_model !== embeddingModel;
  });

  let embedded = 0;
  for (const batch of chunks(changed, 32)) {
    const embeddings = await createOpenAiEmbeddings(apiKey, batch.map((doc) => doc.content), embeddingModel);
    for (let index = 0; index < batch.length; index += 1) {
      await upsertRagDocument(sql, batch[index], embeddings[index], embeddingModel);
      embedded += 1;
    }
  }

  return { embedded, skipped: documents.length - embedded, total: documents.length };
}

export async function askOracleRag(data: OracleData, query: string, env: OracleRagEnv): Promise<InquiryResult> {
  const sql = sqlClient(env);
  const apiKey = openAiKey(env);
  const embeddingModel = env.ORACLE_RAG_EMBEDDING_MODEL || DEFAULT_RAG_EMBEDDING_MODEL;
  const answerModel = env.ORACLE_RAG_ANSWER_MODEL || DEFAULT_RAG_ANSWER_MODEL;
  const topK = topKFromEnv(env);
  const queryEmbedding = (await createOpenAiEmbeddings(apiKey, [query], embeddingModel))[0];
  const vector = vectorLiteral(queryEmbedding);

  let rows: RagDocumentRow[];
  try {
    const result = await sql`
      select id, entity_type, entity_id, title, content, citations, source_systems,
             1 - (embedding <=> ${vector}::vector) as score
      from oracle_rag_documents
      where embedding is not null
      order by embedding <=> ${vector}::vector
      limit ${topK * 2}
    `;
    rows = dedupeRows(result as RagDocumentRow[], topK);
  } catch (error) {
    throw new OracleRagError("retrieval-failed", messageOf(error));
  }

  if (!rows.length) {
    throw new OracleRagError("empty-rag-index", "The oracle_rag_documents table has no embedded documents. Run pnpm rag:seed first.");
  }

  const citations = uniqueCitations(rows.flatMap((row) => parseCitations(row.citations)));
  const cards = rows.map((row) => cardForRow(data, row)).filter((card): card is ResultCard => Boolean(card));
  const answer = await synthesizeAnswer(apiKey, answerModel, query, rows, citations);
  const retrieved = rows.map((row) => ({
    id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    title: row.title,
    score: roundScore(row.score)
  }));

  return {
    query,
    headerLabel: query,
    count: cards.length,
    note: "Semantic RAG retrieval over Neon pgvector with OpenAI embeddings and LLM synthesis.",
    cards,
    citations,
    hasAnswer: true,
    answer,
    isGraph: false,
    retrieval: {
      mode: "pgvector",
      provider: "neon-openai",
      status: "ready",
      embeddingModel,
      answerModel,
      topK,
      retrieved,
      citationCount: citations.length
    }
  };
}

export function createRagUnavailableResult(query: string, error: unknown, env: OracleRagEnv = {}): InquiryResult {
  const ragError = toOracleRagError(error);
  return {
    query,
    headerLabel: query,
    count: 0,
    note: "Server-side RAG is not configured for this free-text query.",
    cards: [],
    citations: [],
    hasAnswer: true,
    answer: `${ragError.message} The initial fixture view and structured filters still work; configure DATABASE_URL, OPENAI_API_KEY, and run pnpm rag:seed to enable natural-language RAG.`,
    isGraph: false,
    retrieval: {
      mode: "pgvector",
      provider: "neon-openai",
      status: ragError.code === "missing-database-url" || ragError.code === "missing-openai-api-key" ? "unconfigured" : "error",
      embeddingModel: env.ORACLE_RAG_EMBEDDING_MODEL || DEFAULT_RAG_EMBEDDING_MODEL,
      answerModel: env.ORACLE_RAG_ANSWER_MODEL || DEFAULT_RAG_ANSWER_MODEL,
      topK: topKFromEnv(env),
      retrieved: [],
      citationCount: 0,
      errorCode: ragError.code,
      message: ragError.message
    }
  };
}

async function ensureRagSchema(sql: SqlClient): Promise<void> {
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

async function upsertRagDocument(sql: SqlClient, doc: OracleRagDocument, embedding: number[], embeddingModel: string): Promise<void> {
  const vector = vectorLiteral(embedding);
  await sql`
    insert into oracle_rag_documents (
      id, entity_type, entity_id, title, content, content_hash,
      source_systems, citations, metadata, embedding, embedding_model, updated_at
    )
    values (
      ${doc.id}, ${doc.entityType}, ${doc.entityId}, ${doc.title}, ${doc.content}, ${doc.contentHash},
      ${JSON.stringify(doc.sourceSystems)}::jsonb, ${JSON.stringify(doc.citations)}::jsonb, ${JSON.stringify(doc.metadata)}::jsonb,
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

function cardForRow(data: OracleData, row: RagDocumentRow): ResultCard | null {
  if (row.entity_type === "property") {
    const property = findPropertyForRow(data, row);
    return property ? cardProperty(property, parseCitations(row.citations).length, row) : genericCard(row);
  }
  if (row.entity_type === "contractor") {
    const contractor = findByIdOrTitle(data.contractors, row, (item) => item.name);
    return contractor ? cardContractor(contractor, parseCitations(row.citations).length, row) : genericCard(row);
  }
  if (row.entity_type === "business") {
    const business = findByIdOrTitle(data.businesses, row, (item) => item.name);
    return business ? cardBusiness(business, parseCitations(row.citations).length, row) : genericCard(row);
  }
  if (row.entity_type === "owner") {
    const owner = findByIdOrTitle(data.owners, row, (item) => item.name);
    return owner ? cardOwner(owner, parseCitations(row.citations).length, row) : genericCard(row);
  }
  if (row.entity_type === "tenant") {
    const tenant = findByIdOrTitle(data.tenants, row, (item) => item.name);
    return tenant ? cardTenant(tenant, parseCitations(row.citations).length, row) : genericCard(row);
  }
  return genericCard(row);
}

function findPropertyForRow(data: OracleData, row: RagDocumentRow): PropertyRecord | undefined {
  return data.properties.find((item) => item.id === row.entity_id) ?? data.properties.find((item) => sameEntityTitle(item.address, row.title));
}

function findByIdOrTitle<T extends { id: string }>(items: T[], row: RagDocumentRow, titleOf: (item: T) => string): T | undefined {
  return items.find((item) => item.id === row.entity_id) ?? items.find((item) => sameEntityTitle(titleOf(item), row.title));
}

function sameEntityTitle(left: string, right: string): boolean {
  return entityTitleKey(left) === entityTitleKey(right);
}

function entityTitleKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function cardProperty(property: PropertyRecord, cite: number, row: RagDocumentRow): ResultCard {
  const open = property.permits.filter((permit) => isOpenPermit(permit.status)).length;
  return {
    key: property.id,
    type: "property",
    title: property.address,
    subtitle: `${property.city} - ${property.neighborhood}`,
    badges: [badge(property.class, "blue"), badge(`${open} open`, open ? "accent" : "gray"), badge(`RAG ${roundScore(row.score).toFixed(2)}`, "green")],
    metas: [
      { k: "Owner", v: property.owner },
      { k: "Parcel", v: property.parcel },
      { k: "Permits", v: String(property.permits.length) }
    ],
    cite
  };
}

function cardContractor(contractor: ContractorRecord, cite: number, row: RagDocumentRow): ResultCard {
  return {
    key: contractor.id,
    type: "contractor",
    title: contractor.name,
    subtitle: `${contractor.license} - ${contractor.trades.join(", ")}`,
    badges: [badgeFromTone(`BBB ${contractor.bbb}`, bbbTone(contractor.bbb)), badge(`${contractor.projects} projects`, "blue"), badge(`RAG ${roundScore(row.score).toFixed(2)}`, "green")],
    metas: [
      { k: "Complaints", v: String(contractor.complaints.length) },
      { k: "Review", v: contractor.review.toFixed(1) },
      { k: "County", v: contractor.county }
    ],
    cite
  };
}

function cardBusiness(business: BusinessRecord, cite: number, row: RagDocumentRow): ResultCard {
  return {
    key: business.id,
    type: "business",
    title: business.name,
    subtitle: `${business.btype} - ${business.status}`,
    badges: [badge(`${business.locations.length} locations`, business.locations.length > 1 ? "accent" : "gray"), badge(business.status, business.status === "Active" ? "green" : "amber"), badge(`RAG ${roundScore(row.score).toFixed(2)}`, "green")],
    metas: [
      { k: "Sunbiz", v: business.sunbiz },
      { k: "Owner", v: business.owner },
      { k: "Registered", v: business.registered }
    ],
    cite
  };
}

function cardOwner(owner: OwnerRecord, cite: number, row: RagDocumentRow): ResultCard {
  return {
    key: owner.id,
    type: "owner",
    title: owner.name,
    subtitle: `${owner.type} owner`,
    badges: [badge(`${owner.props.length} properties`, owner.props.length > 1 ? "accent" : "gray"), badge(`RAG ${roundScore(row.score).toFixed(2)}`, "green")],
    metas: [
      { k: "Since", v: owner.since },
      { k: "Type", v: owner.type }
    ],
    cite
  };
}

function cardTenant(tenant: TenantRecord, cite: number, row: RagDocumentRow): ResultCard {
  return {
    key: tenant.id,
    type: "tenant",
    title: tenant.name,
    subtitle: tenant.ttype,
    badges: [badge(`${tenant.locations.length} locations`, tenant.locations.length > 1 ? "accent" : "gray"), badge(tenant.activity, tenant.activity.includes("Turnover") ? "amber" : "blue"), badge(`RAG ${roundScore(row.score).toFixed(2)}`, "green")],
    metas: [
      { k: "Businesses", v: String(tenant.businesses.length) },
      { k: "Activity", v: tenant.activity }
    ],
    cite
  };
}

function genericCard(row: RagDocumentRow): ResultCard {
  return {
    key: row.entity_id,
    type: row.entity_type,
    title: row.title,
    subtitle: `${row.entity_type} evidence chunk`,
    badges: [badge(`RAG ${roundScore(row.score).toFixed(2)}`, "green")],
    metas: [{ k: "Chunk", v: row.id }],
    cite: parseCitations(row.citations).length
  };
}

async function synthesizeAnswer(apiKey: string, model: string, query: string, rows: RagDocumentRow[], citations: SourceProvenance[]): Promise<string> {
  const evidence = rows.map((row, index) => {
    const citationLabels = parseCitations(row.citations).map((citation) => citation.entity || citation.system).slice(0, 3).join("; ");
    return `[R${index + 1}] ${row.title} (${row.entity_type}:${row.entity_id}, score ${roundScore(row.score).toFixed(3)})\nSources: ${citationLabels || "source metadata attached"}\n${row.content}`;
  }).join("\n\n");
  const sourceList = citations.map((citation, index) => `[S${index + 1}] ${citation.system}: ${citation.entity || citation.url}`).join("\n");
  const body = {
    model,
    reasoning: { effort: "low" },
    instructions: [
      "You are the Oracle property intelligence RAG answerer.",
      "Answer only from the retrieved evidence.",
      "Use concise operator-facing language.",
      "Cite retrieved chunks with bracketed labels like [R1] and mention source systems when relevant.",
      "If the evidence is insufficient, say what is missing instead of inventing facts."
    ].join("\n"),
    input: `Question: ${query}\n\nRetrieved evidence:\n${evidence}\n\nAvailable source systems:\n${sourceList}`
  };

  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    });
  } catch (error) {
    throw new OracleRagError("llm-failed", messageOf(error));
  }

  if (!response.ok) {
    throw new OracleRagError("llm-failed", await response.text());
  }

  const json = await response.json() as { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> };
  const text = json.output_text || json.output?.flatMap((item) => item.content ?? []).map((item) => item.text).filter(Boolean).join("\n");
  if (!text) throw new OracleRagError("llm-failed", "OpenAI returned no text output.");
  return text;
}

async function createOpenAiEmbeddings(apiKey: string, inputs: string[], model: string): Promise<number[][]> {
  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({ model, input: inputs, encoding_format: "float" })
    });
  } catch (error) {
    throw new OracleRagError("embedding-failed", messageOf(error));
  }

  if (!response.ok) {
    throw new OracleRagError("embedding-failed", await response.text());
  }

  const json = await response.json() as { data?: Array<{ embedding: number[] }> };
  const embeddings = json.data?.map((item) => item.embedding) ?? [];
  if (embeddings.length !== inputs.length) {
    throw new OracleRagError("embedding-failed", `Expected ${inputs.length} embeddings, received ${embeddings.length}.`);
  }
  return embeddings;
}

function sqlClient(env: OracleRagEnv): SqlClient {
  if (!env.DATABASE_URL?.trim()) {
    throw new OracleRagError("missing-database-url", "DATABASE_URL is required for Neon pgvector RAG.");
  }
  return neon(env.DATABASE_URL);
}

function openAiKey(env: OracleRagEnv): string {
  if (!env.OPENAI_API_KEY?.trim()) {
    throw new OracleRagError("missing-openai-api-key", "OPENAI_API_KEY is required for OpenAI embeddings and LLM synthesis.");
  }
  return env.OPENAI_API_KEY;
}

function contractorsFor(data: OracleData, property: PropertyRecord): ContractorRecord[] {
  const ids = new Set(property.permits.map((permit) => permit.contractor));
  return data.contractors.filter((contractor) => ids.has(contractor.id));
}

function sourceSystems(sources: SourceProvenance[]): string[] {
  return [...new Set(sources.map((source) => source.system).filter(Boolean))];
}

function uniqueCitations(citations: SourceProvenance[]): SourceProvenance[] {
  const out = new Map<string, SourceProvenance>();
  for (const citation of citations) {
    out.set(`${citation.system}:${citation.url}:${citation.entity ?? ""}`, citation);
  }
  return [...out.values()];
}

function parseCitations(value: SourceProvenance[] | string): SourceProvenance[] {
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed as SourceProvenance[] : [];
  } catch {
    return [];
  }
}

function dedupeRows(rows: RagDocumentRow[], topK: number): RagDocumentRow[] {
  const out: RagDocumentRow[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const key = `${row.entity_type}:${row.entity_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
    if (out.length >= topK) break;
  }
  return out;
}

function toOracleRagError(error: unknown): OracleRagError {
  if (error instanceof OracleRagError) return error;
  return new OracleRagError("retrieval-failed", messageOf(error));
}

function topKFromEnv(env: OracleRagEnv): number {
  const parsed = Number(env.ORACLE_RAG_TOP_K);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(Math.round(parsed), 20)) : DEFAULT_RAG_TOP_K;
}

function vectorLiteral(values: number[]): string {
  return `[${values.map((value) => Number(value).toFixed(8)).join(",")}]`;
}

function roundScore(value: number | string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 10000) / 10000 : 0;
}

function stableHash(value: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < value.length; i += 1) {
    const ch = value.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `${(h2 >>> 0).toString(16).padStart(8, "0")}${(h1 >>> 0).toString(16).padStart(8, "0")}`;
}

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    out.push(items.slice(index, index + size));
  }
  return out;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
