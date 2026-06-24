export const AGENT_STATUSES = [
  "Discovered",
  "Registered",
  "In Review",
  "Changes Requested",
  "Certified",
  "Rejected",
  "Deprecated",
  "Suspended"
] as const;

export type AgentStatus = (typeof AGENT_STATUSES)[number];

export type EntityType =
  | "property"
  | "contractor"
  | "business"
  | "owner"
  | "tenant"
  | "project"
  | "neighborhood"
  | "graph";

export type LexiconEntityName =
  | "Property"
  | "Owner"
  | "Tenant"
  | "Business"
  | "Contractor"
  | "Permit"
  | "Address"
  | "Parcel"
  | "Project"
  | "Review"
  | "Complaint"
  | "PublicRecord";

export interface SourceProvenance {
  system: string;
  url: string;
  collected: string;
  refreshed: string;
  entity?: string;
}

export interface LexiconEntityDefinition {
  name: LexiconEntityName;
  durableId: string;
  description: string;
  sourceSystems: string[];
  requiredFields: string[];
  provenanceFields: string[];
}

export interface LexiconRelationshipDefinition {
  id: string;
  from: LexiconEntityName;
  to: LexiconEntityName;
  label: string;
  cardinality: "one-to-one" | "one-to-many" | "many-to-one" | "many-to-many";
  evidence: string[];
}

export interface StructuredQuery {
  entity?: EntityType;
  county?: string;
  municipality?: string;
  permitType?: string;
  contractor?: string;
  propertyClass?: string;
  businessType?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  limit?: number;
}

export interface Permit {
  id: string;
  type: string;
  status: string;
  contractor: string;
  value: number;
  filed: string;
  scope: string;
  major: boolean;
}

export interface OwnerHistoryItem {
  owner: string;
  date: string;
  type: string;
}

export interface PropertyRecord {
  id: string;
  address: string;
  city: string;
  neighborhood: string;
  parcel: string;
  class: string;
  year: number;
  owner: string;
  ownerHistory: OwnerHistoryItem[];
  tenants: string[];
  businesses: string[];
  permits: Permit[];
  src: SourceProvenance[];
}

export interface ContractorComplaint {
  date: string;
  summary: string;
  status: string;
}

export interface ContractorRecord {
  id: string;
  name: string;
  license: string;
  trades: string[];
  county: string;
  projects: number;
  bbb: string;
  complaints: ContractorComplaint[];
  review: number;
  src: SourceProvenance[];
}

export interface OwnerRecord {
  id: string;
  name: string;
  type: string;
  since: string;
  props: string[];
  src: SourceProvenance[];
}

export interface BusinessRecord {
  id: string;
  name: string;
  btype: string;
  sunbiz: string;
  status: string;
  owner: string;
  locations: string[];
  registered: string;
  src: SourceProvenance[];
}

export interface TenantRecord {
  id: string;
  name: string;
  ttype: string;
  locations: string[];
  businesses: string[];
  activity: string;
  src: SourceProvenance[];
}

export interface AgentRecord {
  id: string;
  display: string;
  role: string;
  status: AgentStatus;
  version: string;
  summary: string;
  triggers: string;
  iconUrl?: string;
  iconLabel?: string;
  skills: string[];
  deps: string[];
  runtime: string;
  docs: string;
  source: "self" | "team-kit";
  new?: boolean;
  certifiedDate: string | null;
  reviewer: string | null;
  sourcePath?: string;
  sourceRepo?: string;
  sourceCommit?: string;
  model?: string;
  owner?: string;
  capabilities?: string[];
  inputs?: string[];
  outputs?: string[];
  usage?: string;
  install?: string;
  dataSources?: string[];
  connectedTools?: string[];
  networkInteractions?: string[];
  runCount?: number;
  lastRunAt?: string;
}

export interface SourceSnapshot {
  id: string;
  label: string;
  repo: string;
  ref: string;
  commit: string;
  files: number;
  agents?: number;
  skills?: number;
  includes?: string[];
}

export interface InquiryDefinition {
  id: string;
  label: string;
  entity: EntityType;
  kind: string;
  arg?: string;
}

export interface CorpusSummary {
  properties: number;
  permits: number;
  contractors: number;
  businesses: number;
  owners: number;
  tenants: number;
  sources: number;
  lastRefresh: string;
  county: string;
}

export interface OracleData {
  contractors: ContractorRecord[];
  owners: OwnerRecord[];
  businesses: BusinessRecord[];
  tenants: TenantRecord[];
  properties: PropertyRecord[];
  agents: AgentRecord[];
  inquiries: InquiryDefinition[];
  turnover: Record<string, string>;
  corpus: CorpusSummary;
  sourceSnapshots?: SourceSnapshot[];
}

export interface CommandCenterSnapshot {
  data: OracleData;
  registry: RegistryState;
  evidenceRuns: EvidenceRun[];
}

export type DataPlaneMode = "fixture" | "elephant-query-db";

export interface DataPlaneStatus {
  configuredMode: DataPlaneMode;
  activeMode: DataPlaneMode;
  ready: boolean;
  server: boolean;
  resource: string;
  message: string;
  contractSource?: string;
  fallbackReason?: string;
  coverage?: Record<string, number>;
  missing?: string[];
}

export interface RetrievedChunk {
  id: string;
  entityType: EntityType;
  entityId: string;
  title: string;
  score: number;
}

export interface RetrievalMetadata {
  mode: "deterministic" | "pgvector";
  provider: "local" | "neon-openai";
  status: "ready" | "unconfigured" | "error";
  embeddingModel?: string;
  answerModel?: string;
  topK?: number;
  retrieved: RetrievedChunk[];
  citationCount: number;
  errorCode?: string;
  message?: string;
}

export interface Tone {
  bg: string;
  fg: string;
  bd: string;
}

export interface ResultBadge extends Tone {
  label: string;
}

export interface ResultMeta {
  k: string;
  v: string;
}

export interface ResultCard {
  key: string;
  type: EntityType;
  title: string;
  subtitle: string;
  badges: ResultBadge[];
  metas: ResultMeta[];
  cite: number;
}

export interface InquiryResult {
  query: string;
  headerLabel: string;
  count: number;
  note: string;
  cards: ResultCard[];
  citations: SourceProvenance[];
  hasAnswer: boolean;
  answer?: string;
  isGraph: boolean;
  retrieval?: RetrievalMetadata;
}

export interface DetailRow {
  primary: string;
  secondary?: string;
  value?: string;
  meta?: string;
  tag?: string;
  tone?: string;
}

export interface DetailSection {
  title: string;
  rows: DetailRow[];
  empty: boolean;
}

export interface EntityDetail {
  id: string;
  type: EntityType;
  title: string;
  subtitle: string;
  signals: ResultBadge[];
  sections: DetailSection[];
  citations: SourceProvenance[];
}

export interface GraphCluster {
  title: string;
  nodes: Array<{ name: string; role: string }>;
}

export interface RelationshipGraph {
  center: { title: string; sub: string };
  clusters: GraphCluster[];
}

export interface EvidenceRun {
  id: string;
  query: string;
  ts: string;
  cert: AgentStatus;
  agentId: string;
  evaluatorId: string;
  certifierId: string | null;
  certifiedAt: string | null;
  count: number;
  summary: string;
  sources: string[];
  citations: SourceProvenance[];
  resultKeys: string[];
  retrieval?: RetrievalMetadata;
}

export interface RegistryState {
  statuses: Record<string, AgentStatus>;
  certDates: Record<string, string>;
  history: CertificationDecision[];
  reviewer: string;
}

export interface CertificationDecision {
  id: string;
  agentId: string;
  from: AgentStatus;
  to: AgentStatus;
  reviewer: string;
  decidedAt: string;
  outcome: string;
  notes: string;
  evaluationScore: number;
  checks: string[];
}

export const tones: Record<string, Tone> = {
  green: { bg: "rgba(95,208,138,0.13)", fg: "#7fe0a3", bd: "rgba(95,208,138,0.34)" },
  amber: { bg: "rgba(232,183,90,0.13)", fg: "#edc775", bd: "rgba(232,183,90,0.34)" },
  red: { bg: "rgba(242,118,107,0.13)", fg: "#f59083", bd: "rgba(242,118,107,0.38)" },
  blue: { bg: "rgba(106,169,240,0.13)", fg: "#8fbdf5", bd: "rgba(106,169,240,0.34)" },
  gray: { bg: "rgba(154,167,180,0.11)", fg: "#aab4c0", bd: "rgba(154,167,180,0.26)" },
  accent: { bg: "rgba(70,213,196,0.13)", fg: "#5fe0d0", bd: "rgba(70,213,196,0.36)" }
};

export function tone(name: string): Tone {
  return tones[name] ?? tones.gray;
}

export function statusTone(status: AgentStatus): Tone {
  const map: Record<AgentStatus, string> = {
    Discovered: "gray",
    Registered: "blue",
    "In Review": "amber",
    "Changes Requested": "amber",
    Certified: "green",
    Rejected: "red",
    Deprecated: "gray",
    Suspended: "red"
  };
  return tone(map[status]);
}

export function bbbTone(rating: string): Tone {
  if (["A+", "A", "A-"].includes(rating)) return tone("green");
  if (["B+", "B"].includes(rating)) return tone("blue");
  if (rating === "C") return tone("amber");
  if (["D", "F"].includes(rating)) return tone("red");
  return tone("gray");
}

export function permitTone(status: string): Tone {
  return isOpenPermit(status) ? tone("accent") : status === "Expired" ? tone("amber") : tone("gray");
}

export function isOpenPermit(status: string): boolean {
  return ["Open", "Active", "Issued"].includes(status);
}

export function money(value: number): string {
  return `$${Number(value).toLocaleString("en-US")}`;
}

export function badge(label: string, toneName: string): ResultBadge {
  return { label, ...tone(toneName) };
}

export function badgeFromTone(label: string, value: Tone): ResultBadge {
  return { label, ...value };
}

export const ORACLE_LEXICON_ENTITIES: LexiconEntityDefinition[] = [
  {
    name: "Property",
    durableId: "property:{county}:{parcel}",
    description: "A real property or improved parcel reconciled from appraisal, permit, occupancy, and business sources.",
    sourceSystems: ["Lee County Property Appraiser", "Lee County Permitting", "Sunbiz", "BBB"],
    requiredFields: ["id", "address", "city", "parcel", "class", "owner"],
    provenanceFields: ["source.system", "source.url", "source.collected", "source.refreshed"]
  },
  {
    name: "Owner",
    durableId: "owner:{normalized-name}:{county}",
    description: "A person, company, trust, or public entity associated with property ownership history.",
    sourceSystems: ["Lee County Property Appraiser", "Sunbiz"],
    requiredFields: ["id", "name", "type", "since", "props"],
    provenanceFields: ["source.system", "source.url", "source.collected", "source.refreshed"]
  },
  {
    name: "Tenant",
    durableId: "tenant:{normalized-name}:{county}",
    description: "A current or historical occupant linked to one or more properties and associated businesses.",
    sourceSystems: ["Oracle occupancy records", "Sunbiz", "Lee County Permitting"],
    requiredFields: ["id", "name", "ttype", "locations", "businesses"],
    provenanceFields: ["source.system", "source.url", "source.collected", "source.refreshed"]
  },
  {
    name: "Business",
    durableId: "business:{sunbiz-document-number}",
    description: "A Sunbiz-registered operating entity with locations, ownership, and project relationships.",
    sourceSystems: ["Sunbiz", "Lee County Permitting", "BBB"],
    requiredFields: ["id", "name", "btype", "sunbiz", "status", "locations"],
    provenanceFields: ["source.system", "source.url", "source.collected", "source.refreshed"]
  },
  {
    name: "Contractor",
    durableId: "contractor:{license-or-normalized-name}:{county}",
    description: "A contractor or service provider connected to permits, projects, BBB reputation, reviews, and complaints.",
    sourceSystems: ["Lee County Permitting", "BBB", "Sunbiz"],
    requiredFields: ["id", "name", "license", "trades", "bbb", "projects"],
    provenanceFields: ["source.system", "source.url", "source.collected", "source.refreshed"]
  },
  {
    name: "Permit",
    durableId: "permit:{source}:{permit-number}",
    description: "A permit or improvement record classified by status, trade, contractor, scope, value, and filing date.",
    sourceSystems: ["Lee County Permitting"],
    requiredFields: ["id", "type", "status", "contractor", "filed", "scope", "major"],
    provenanceFields: ["source.system", "source.url", "source.collected", "source.refreshed"]
  },
  {
    name: "Address",
    durableId: "address:{normalized-address-hash}",
    description: "A normalized situs, mailing, or operating address used to reconcile parcel, permit, tenant, and business records.",
    sourceSystems: ["Lee County Property Appraiser", "Lee County Permitting", "Sunbiz", "BBB"],
    requiredFields: ["address", "city", "county"],
    provenanceFields: ["source.system", "source.url", "source.collected", "source.refreshed"]
  },
  {
    name: "Parcel",
    durableId: "parcel:{county}:{normalized-parcel-id}",
    description: "A county parcel identifier used as the primary durable join between appraisal and permit sources.",
    sourceSystems: ["Lee County Property Appraiser", "Lee County Permitting"],
    requiredFields: ["parcel", "county"],
    provenanceFields: ["source.system", "source.url", "source.collected", "source.refreshed"]
  },
  {
    name: "Project",
    durableId: "project:{property-id}:{permit-id}",
    description: "A property improvement event derived from one or more permits and linked contractors.",
    sourceSystems: ["Lee County Permitting", "BBB"],
    requiredFields: ["property", "permit", "contractor", "scope"],
    provenanceFields: ["source.system", "source.url", "source.collected", "source.refreshed"]
  },
  {
    name: "Review",
    durableId: "review:{source}:{contractor-or-business}:{review-id}",
    description: "A rating or review summary associated with a contractor or business reputation profile.",
    sourceSystems: ["BBB"],
    requiredFields: ["subject", "rating", "summary"],
    provenanceFields: ["source.system", "source.url", "source.collected", "source.refreshed"]
  },
  {
    name: "Complaint",
    durableId: "complaint:{source}:{contractor-or-business}:{complaint-id}",
    description: "A contractor or business complaint with status, date, and resolution signal.",
    sourceSystems: ["BBB"],
    requiredFields: ["subject", "date", "summary", "status"],
    provenanceFields: ["source.system", "source.url", "source.collected", "source.refreshed"]
  },
  {
    name: "PublicRecord",
    durableId: "public-record:{source}:{record-key}",
    description: "A source-backed public record artifact preserved for lineage, citations, and future MCP exposure.",
    sourceSystems: ["Lee County Property Appraiser", "Lee County Permitting", "Sunbiz", "BBB"],
    requiredFields: ["system", "url", "sourceRecordKey"],
    provenanceFields: ["source.system", "source.url", "source.collected", "source.refreshed", "lineage"]
  }
];

export const ORACLE_LEXICON_RELATIONSHIPS: LexiconRelationshipDefinition[] = [
  { id: "property-owned-by-owner", from: "Property", to: "Owner", label: "owned by", cardinality: "many-to-many", evidence: ["ownerHistory", "property.src"] },
  { id: "property-identified-by-parcel", from: "Property", to: "Parcel", label: "identified by", cardinality: "one-to-one", evidence: ["parcel", "property.src"] },
  { id: "property-located-at-address", from: "Property", to: "Address", label: "located at", cardinality: "one-to-one", evidence: ["address", "city", "property.src"] },
  { id: "property-has-permit", from: "Property", to: "Permit", label: "has permit", cardinality: "one-to-many", evidence: ["permits", "permit.id", "property.src"] },
  { id: "permit-performed-by-contractor", from: "Permit", to: "Contractor", label: "performed by", cardinality: "many-to-one", evidence: ["permit.contractor", "contractor.src"] },
  { id: "property-occupied-by-tenant", from: "Property", to: "Tenant", label: "occupied by", cardinality: "many-to-many", evidence: ["property.tenants", "tenant.src"] },
  { id: "tenant-associated-with-business", from: "Tenant", to: "Business", label: "associated with", cardinality: "many-to-many", evidence: ["tenant.businesses", "business.src"] },
  { id: "business-operates-at-property", from: "Business", to: "Property", label: "operates at", cardinality: "many-to-many", evidence: ["business.locations", "property.src"] },
  { id: "permit-produces-project", from: "Permit", to: "Project", label: "produces", cardinality: "one-to-one", evidence: ["permit.scope", "permit.major", "property.src"] },
  { id: "contractor-has-review", from: "Contractor", to: "Review", label: "has review", cardinality: "one-to-many", evidence: ["contractor.review", "contractor.src"] },
  { id: "contractor-has-complaint", from: "Contractor", to: "Complaint", label: "has complaint", cardinality: "one-to-many", evidence: ["contractor.complaints", "contractor.src"] },
  { id: "public-record-supports-entity", from: "PublicRecord", to: "Property", label: "supports", cardinality: "many-to-many", evidence: ["source.url", "source.collected", "source.refreshed"] }
];
