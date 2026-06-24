import {
  BadgeCheck,
  Boxes,
  ChevronDown,
  ListChecks,
  Network,
  Search,
  SlidersHorizontal,
  Store,
  UserPlus,
} from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import {
  agentActions,
  agentStatus,
  createInitialSnapshot,
  getDetail,
  getRelationshipGraph,
  hiddenAgents,
  getLexicon,
  getRegistryMetrics,
  localFixtureDataPlane,
  marketplaceAgents,
  demoManualAgent,
  type CommandCenterSnapshot
} from "@oracle-command-center/api-client";
import type { ManualAgentRegistration } from "@oracle-command-center/agent-registry";
import {
  AGENT_STATUSES,
  badge,
  statusTone,
  type AgentStatus,
  type AgentRecord,
  type DataPlaneStatus,
  type EntityDetail,
  type EntityType,
  type EvidenceRun,
  type InquiryResult,
  type ResultCard,
  type StructuredQuery
} from "@oracle-command-center/domain";
import {
  registerLocalExternalAgent,
  requestRuntimeAction,
  runLocalNaturalLanguage,
  runLocalRequiredInquiry,
  runLocalStructuredSearch,
  updateLocalAgentStatus,
  type RuntimeActionResponse
} from "./runtimeClient";

type Mode = "intelligence" | "registry" | "marketplace" | "evidence";
type PendingOperationKind = "rag" | "structured" | "required" | "registry";
type PendingOperation = {
  kind: PendingOperationKind;
  title: string;
  query: string;
  detail: string;
  steps: string[];
};

const modeMeta: Array<{ id: Mode; label: string; desc: string; icon: string }> = [
  { id: "intelligence", label: "Intelligence", desc: "Search, explore, inspect", icon: "I" },
  { id: "registry", label: "Registry", desc: "Discover & certify agents", icon: "R" },
  { id: "marketplace", label: "Marketplace", desc: "Certified agents only", icon: "M" },
  { id: "evidence", label: "Evidence", desc: "Provenance ledger", icon: "E" }
];

const inquiryGroups: Record<string, string[]> = {
  "Permits & Renovations": ["q1", "q2", "q3", "q4", "q5", "q6", "q7", "q8"],
  "Contractors & Risk": ["q9", "q10", "q11", "q12", "q13", "q21"],
  "Ownership & Occupancy": ["q14", "q15", "q16", "q17", "q18", "q22"],
  "Neighborhood Signals": ["q19", "q20"],
  Relationships: ["q23"]
};

const defaultInquiryLabel = "Show all properties with more than one open permit";
const entityFilters: Array<{ label: string; value: StructuredQuery["entity"] | "all" }> = [
  { label: "All", value: "all" },
  { label: "Property", value: "property" },
  { label: "Contractor", value: "contractor" },
  { label: "Business", value: "business" },
  { label: "Tenant", value: "tenant" },
  { label: "Owner", value: "owner" }
];

const defaultStructuredQuery: StructuredQuery = {
  entity: "property",
  county: "Lee County, FL",
  municipality: "",
  permitType: "",
  contractor: "",
  propertyClass: "",
  businessType: "",
  status: "",
  dateFrom: "",
  dateTo: "",
  limit: 25
};

const manualListFields = ["skills", "deps", "capabilities", "inputs", "outputs", "dataSources", "connectedTools", "networkInteractions"] as const;
type ManualListField = (typeof manualListFields)[number];

const pendingDetails: Record<PendingOperationKind, { title: string; detail: string; steps: string[] }> = {
  rag: {
    title: "Running RAG retrieval",
    detail: "Embedding the query, searching Neon pgvector, and synthesizing a cited answer.",
    steps: ["Create query embedding", "Retrieve evidence chunks", "Generate cited synthesis"]
  },
  structured: {
    title: "Running structured search",
    detail: "Applying filters across the Oracle property intelligence corpus.",
    steps: ["Apply filters", "Rank matching entities", "Refresh evidence record"]
  },
  required: {
    title: "Running required inquiry",
    detail: "Executing the source-backed assignment query and rebuilding result cards.",
    steps: ["Run inquiry handler", "Collect citations", "Update result set"]
  },
  registry: {
    title: "Updating registry",
    detail: "Submitting the lifecycle change to the command-center runtime.",
    steps: ["Apply governance action", "Refresh registry", "Update evidence state"]
  }
};

function createPendingOperation(kind: PendingOperationKind, query: string): PendingOperation {
  return {
    kind,
    query,
    ...pendingDetails[kind]
  };
}

function cloneManualRegistration(input: ManualAgentRegistration): ManualAgentRegistration {
  return {
    ...input,
    skills: [...(input.skills ?? [])],
    deps: [...(input.deps ?? [])],
    capabilities: [...(input.capabilities ?? [])],
    inputs: [...(input.inputs ?? [])],
    outputs: [...(input.outputs ?? [])],
    dataSources: [...(input.dataSources ?? [])],
    connectedTools: [...(input.connectedTools ?? [])],
    networkInteractions: [...(input.networkInteractions ?? [])]
  };
}

function createBootState() {
  const bootResponse = runLocalRequiredInquiry(createInitialSnapshot(), defaultInquiryLabel);
  const snapshot = bootResponse.snapshot;
  const result = bootResponse.result as InquiryResult;
  return {
    snapshot,
    result,
    selected: firstSelectable(snapshot, result),
    selectedRun: snapshot.evidenceRuns[0]?.id ?? null,
    dataPlane: localFixtureDataPlane
  };
}

export function App() {
  const [boot] = useState(() => createBootState());
  const [snapshot, setSnapshot] = useState<CommandCenterSnapshot>(boot.snapshot);
  const [mode, setMode] = useState<Mode>("intelligence");
  const [query, setQuery] = useState("");
  const [activeInquiry, setActiveInquiry] = useState<string | null>("q1");
  const [structured, setStructured] = useState<StructuredQuery>(defaultStructuredQuery);
  const [result, setResult] = useState<InquiryResult | null>(boot.result);
  const [selected, setSelected] = useState<{ type: EntityType; id: string } | null>(boot.selected);
  const [registrySelection, setRegistrySelection] = useState("oracle");
  const [graphProperty, setGraphProperty] = useState("p10");
  const [selectedRun, setSelectedRun] = useState<string | null>(boot.selectedRun);
  const [dataPlane, setDataPlane] = useState<DataPlaneStatus>(boot.dataPlane);
  const [pendingOperation, setPendingOperation] = useState<PendingOperation | null>(null);
  const [manualFormOpen, setManualFormOpen] = useState(false);
  const [manualRegistration, setManualRegistration] = useState<ManualAgentRegistration>(() => cloneManualRegistration(demoManualAgent));

  const oracleStatus = agentStatus(snapshot, "oracle");
  const detail = selected ? safeGetDetail(snapshot, selected.type, selected.id) : null;
  const graph = result?.isGraph ? safeGetRelationshipGraph(snapshot, graphProperty) : null;
  const lexicon = useMemo(() => getLexicon(snapshot), [snapshot]);

  useEffect(() => {
    let cancelled = false;
    void requestRuntimeAction({ action: "boot" }).then((response) => {
      if (!response || cancelled) return;
      applyRuntimeResponse(response, { replaceResult: true });
      const nextSelection = firstSelectable(response.snapshot, response.result ?? null);
      if (nextSelection?.type === "property") setGraphProperty(nextSelection.id);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function applyRuntimeResponse(response: RuntimeActionResponse, options: { replaceResult?: boolean } = {}) {
    setSnapshot(response.snapshot);
    setDataPlane(response.dataPlane);
    if (options.replaceResult && response.result) {
      setResult(response.result);
      const nextSelection = firstSelectable(response.snapshot, response.result);
      setSelected(nextSelection);
      if (nextSelection?.type === "property") setGraphProperty(nextSelection.id);
      setSelectedRun(response.snapshot.evidenceRuns[0]?.id ?? null);
    }
  }

  async function runInquiry(label: string) {
    if (pendingOperation) return;
    const pending = createPendingOperation("rag", label);
    setQuery(label);
    setPendingOperation(pending);
    setActiveInquiry(snapshot.data.inquiries.find((inquiry) => inquiry.label === label)?.id ?? null);
    try {
      const response = (await requestRuntimeAction({ action: "askNaturalLanguage", query: label })) ?? runLocalNaturalLanguage(snapshot, label);
      applyRuntimeResponse(response, { replaceResult: true });
      setActiveInquiry(response.snapshot.data.inquiries.find((inquiry) => inquiry.label === label)?.id ?? null);
    } finally {
      setPendingOperation((current) => (current === pending ? null : current));
    }
  }

  async function runTextQuery() {
    const text = query.trim();
    if (!text || pendingOperation) return;
    const pending = createPendingOperation("rag", text);
    setPendingOperation(pending);
    setActiveInquiry(null);
    try {
      const response = (await requestRuntimeAction({ action: "askNaturalLanguage", query: text })) ?? runLocalNaturalLanguage(snapshot, text);
      applyRuntimeResponse(response, { replaceResult: true });
    } finally {
      setPendingOperation((current) => (current === pending ? null : current));
    }
  }

  async function runStructuredQuery() {
    if (pendingOperation) return;
    const cleaned = cleanStructuredQuery(structured);
    const pending = createPendingOperation("structured", structuredQuerySummary(cleaned));
    setPendingOperation(pending);
    setActiveInquiry(null);
    try {
      const response = (await requestRuntimeAction({ action: "structuredSearch", structured: cleaned })) ?? runLocalStructuredSearch(snapshot, cleaned);
      applyRuntimeResponse(response, { replaceResult: true });
    } finally {
      setPendingOperation((current) => (current === pending ? null : current));
    }
  }

  async function advanceAgentLifecycle(agentId: string, to: AgentStatus) {
    if (pendingOperation) return;
    const pending = createPendingOperation("registry", `${agentId} -> ${to}`);
    setPendingOperation(pending);
    try {
      const response = (await requestRuntimeAction({ action: "updateAgentStatus", agentId, status: to })) ?? updateLocalAgentStatus(snapshot, agentId, to);
      applyRuntimeResponse(response);
    } finally {
      setPendingOperation((current) => (current === pending ? null : current));
    }
  }

  function openExternalRegistrationForm() {
    setManualRegistration(cloneManualRegistration(demoManualAgent));
    setManualFormOpen(true);
    setMode("registry");
  }

  async function submitExternalRegistration(registration: ManualAgentRegistration) {
    if (pendingOperation) return;
    const pending = createPendingOperation("registry", `Register external agent ${registration.display}`);
    setPendingOperation(pending);
    try {
      const response = (await requestRuntimeAction({ action: "registerExternalAgent", registration })) ?? registerLocalExternalAgent(snapshot, registration);
      applyRuntimeResponse(response);
      if (response.agentId) setRegistrySelection(response.agentId);
      setManualFormOpen(false);
      setMode("registry");
    } finally {
      setPendingOperation((current) => (current === pending ? null : current));
    }
  }

  const selectedEvidence = snapshot.evidenceRuns.find((run) => run.id === selectedRun) ?? snapshot.evidenceRuns[0] ?? null;

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand-mark">◇</div>
        <div className="brand-copy">
          <div className="brand-title">
            Oracle <span>Command Center</span>
          </div>
          <div className="brand-subtitle">
            <span>AGENT NETWORK</span>
            <span>PROPERTY INTELLIGENCE</span>
          </div>
        </div>
        <div className="top-spacer" />
        <Metric value={String(snapshot.data.corpus.properties)} label="parcels" />
        <Metric value={String(snapshot.data.corpus.permits)} label="permits" />
        <Metric value={String(snapshot.data.corpus.sources)} label="sources" />
        <Metric value="Lee, FL" label="county" />
        <StatusPill label={`oracle · ${oracleStatus}`} status={oracleStatus} />
      </header>

      <div className="layout">
        <aside className="nav">
          <div className="eyebrow">Workspace Modes</div>
          {modeMeta.map((item) => {
            return (
              <button className={`mode-button ${mode === item.id ? "active" : ""}`} key={item.id} onClick={() => setMode(item.id)}>
                <span className="mode-icon">
                  {item.icon}
                </span>
                <span>
                  <strong>{item.label}</strong>
                  <small>{item.desc}</small>
                </span>
              </button>
            );
          })}
          <DataPlaneCard dataPlane={dataPlane} lastRefresh={snapshot.data.corpus.lastRefresh} />
        </aside>

        <main className="main">
          {mode === "intelligence" && (
            <Intelligence
              snapshot={snapshot}
              result={result}
              detail={detail}
              graph={graph}
              activeInquiry={activeInquiry}
              query={query}
              structured={structured}
              lexicon={lexicon}
              graphProperty={graphProperty}
              oracleStatus={oracleStatus}
              pendingOperation={pendingOperation}
              onQuery={setQuery}
              onStructured={setStructured}
              onRunText={runTextQuery}
              onRunStructured={runStructuredQuery}
              onRunInquiry={runInquiry}
              onSelect={setSelected}
              onGraphProperty={(propertyId) => {
                setGraphProperty(propertyId);
                setSelected({ type: "property", id: propertyId });
              }}
            />
          )}
          {mode === "registry" && (
            <Registry
              snapshot={snapshot}
              selection={registrySelection}
              onSelect={setRegistrySelection}
              onAdvance={advanceAgentLifecycle}
              onRegisterExternal={openExternalRegistrationForm}
              onMarketplace={() => setMode("marketplace")}
            />
          )}
          {mode === "marketplace" && <Marketplace snapshot={snapshot} />}
          {mode === "evidence" && (
            <Evidence runs={snapshot.evidenceRuns} selected={selectedEvidence} onSelect={(run) => setSelectedRun(run.id)} />
          )}
        </main>
      </div>
      {manualFormOpen && (
        <ManualRegistrationModal
          registration={manualRegistration}
          pending={pendingOperation?.kind === "registry"}
          onChange={setManualRegistration}
          onClose={() => setManualFormOpen(false)}
          onReset={() => setManualRegistration(cloneManualRegistration(demoManualAgent))}
          onSubmit={submitExternalRegistration}
        />
      )}
    </div>
  );
}

function Intelligence(props: {
  snapshot: CommandCenterSnapshot;
  result: InquiryResult | null;
  detail: EntityDetail | null;
  graph: ReturnType<typeof getRelationshipGraph> | null;
  activeInquiry: string | null;
  query: string;
  structured: StructuredQuery;
  lexicon: ReturnType<typeof getLexicon>;
  graphProperty: string;
  oracleStatus: string;
  pendingOperation: PendingOperation | null;
  onQuery: (query: string) => void;
  onStructured: (query: StructuredQuery) => void;
  onRunText: () => void;
  onRunStructured: () => void;
  onRunInquiry: (label: string) => void;
  onSelect: (selected: { type: EntityType; id: string }) => void;
  onGraphProperty: (propertyId: string) => void;
}) {
  const busy = Boolean(props.pendingOperation);
  const [inquiryDrawerOpen, setInquiryDrawerOpen] = useState(false);
  const selectedInquiry = props.activeInquiry ? props.snapshot.data.inquiries.find((inquiry) => inquiry.id === props.activeInquiry) : null;

  function runDrawerInquiry(label: string) {
    props.onRunInquiry(label);
    setInquiryDrawerOpen(false);
  }

  return (
    <div className="intelligence-view">
      <div className={`banner ${props.oracleStatus === "Certified" ? "good" : "warn"}`}>
        <span className="banner-dot" />
        <span>
          {props.oracleStatus === "Certified"
            ? "Results produced by certified agent oracle. Every record is source-backed and lineage-tracked."
            : `Responsible agent oracle is ${props.oracleStatus} — results are provisional until certified in the Registry.`}
        </span>
        <span className="banner-gate">governance gate active</span>
      </div>

      <div className="three-panel">
        <section className="query-panel">
          <div className="query-box">
            <div className="eyebrow">RAG Query Console</div>
            <div className={`search-row ${busy ? "busy" : ""}`}>
              <Search size={16} />
              <input
                placeholder="Ask the knowledge layer..."
                value={props.query}
                disabled={busy}
                onChange={(event) => props.onQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !busy) props.onRunText();
                }}
              />
              <button disabled={busy || !props.query.trim()} onClick={props.onRunText}>
                {props.pendingOperation?.kind === "rag" ? (
                  <>
                    <span className="mini-spinner" />
                    Running
                  </>
                ) : (
                  "Run"
                )}
              </button>
            </div>
            {props.pendingOperation && (
              <div className="query-status" aria-live="polite">
                <span className="mini-spinner" />
                <strong>{props.pendingOperation.title}</strong>
                <small>{props.pendingOperation.detail}</small>
              </div>
            )}
            <div className="filter-tabs">
              {entityFilters.map((filter) => (
                <button
                  className={(props.structured.entity ?? "all") === filter.value ? "active" : ""} 
                  disabled={busy}
                  key={filter.label}
                  onClick={() => props.onStructured({ ...props.structured, entity: filter.value === "all" ? undefined : filter.value })}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
          <div className="structured-box">
            <div className="structured-head">
              <div>
                <div className="eyebrow">Structured Query</div>
                <strong>{props.lexicon.entities.length} entities · {props.lexicon.relationships.length} relationships</strong>
              </div>
              <SlidersHorizontal size={18} />
            </div>
            <div className="structured-grid">
              <label>
                <span>Municipality</span>
                <select disabled={busy} value={props.structured.municipality ?? ""} onChange={(event) => props.onStructured({ ...props.structured, municipality: event.target.value })}>
                  <option value="">Any</option>
                  {unique(props.snapshot.data.properties.map((property) => property.city)).map((value) => (
                    <option value={value} key={value}>{value}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Permit</span>
                <select disabled={busy} value={props.structured.permitType ?? ""} onChange={(event) => props.onStructured({ ...props.structured, permitType: event.target.value })}>
                  <option value="">Any</option>
                  {unique(props.snapshot.data.properties.flatMap((property) => property.permits.map((permit) => permit.type))).map((value) => (
                    <option value={value} key={value}>{value}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Class</span>
                <select disabled={busy} value={props.structured.propertyClass ?? ""} onChange={(event) => props.onStructured({ ...props.structured, propertyClass: event.target.value })}>
                  <option value="">Any</option>
                  {unique(props.snapshot.data.properties.map((property) => property.class)).map((value) => (
                    <option value={value} key={value}>{value}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Business</span>
                <select disabled={busy} value={props.structured.businessType ?? ""} onChange={(event) => props.onStructured({ ...props.structured, businessType: event.target.value })}>
                  <option value="">Any</option>
                  {unique(props.snapshot.data.businesses.map((business) => business.btype)).map((value) => (
                    <option value={value} key={value}>{value}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Status</span>
                <select disabled={busy} value={props.structured.status ?? ""} onChange={(event) => props.onStructured({ ...props.structured, status: event.target.value })}>
                  <option value="">Any</option>
                  {["Open", "Active", "Issued", "Closed", "Expired"].map((value) => (
                    <option value={value} key={value}>{value}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Contractor</span>
                <input disabled={busy} value={props.structured.contractor ?? ""} onChange={(event) => props.onStructured({ ...props.structured, contractor: event.target.value })} placeholder="Name or trade" />
              </label>
              <label>
                <span>From</span>
                <input disabled={busy} value={props.structured.dateFrom ?? ""} onChange={(event) => props.onStructured({ ...props.structured, dateFrom: event.target.value })} placeholder="2026-01-01" />
              </label>
              <label>
                <span>To</span>
                <input disabled={busy} value={props.structured.dateTo ?? ""} onChange={(event) => props.onStructured({ ...props.structured, dateTo: event.target.value })} placeholder="2026-06-18" />
              </label>
            </div>
            <button className="structured-run" disabled={busy} onClick={props.onRunStructured}>
              {props.pendingOperation?.kind === "structured" ? "Running structured..." : "Run structured"}
            </button>
          </div>
          <div className={`inquiry-drawer ${inquiryDrawerOpen ? "open" : ""}`}>
            <button
              aria-expanded={inquiryDrawerOpen}
              className="drawer-trigger"
              disabled={busy}
              onClick={() => setInquiryDrawerOpen((open) => !open)}
              type="button"
            >
              <ListChecks size={16} />
              <span>
                <strong>Required Demo Inquiries</strong>
                <small>{selectedInquiry?.label ?? `${props.snapshot.data.inquiries.length} prompts route through RAG`}</small>
              </span>
              <ChevronDown size={16} className="drawer-chevron" />
            </button>
            {inquiryDrawerOpen && (
              <div className="drawer-panel">
                <p className="drawer-note">Selecting a prompt populates the RAG search and runs the same workflow as pressing Run.</p>
                <div className="chips">
                  {Object.entries(inquiryGroups).map(([group, ids]) => (
                    <div key={group} className="chip-group">
                      <div className="eyebrow">{group}</div>
                      {ids.map((id) => {
                        const inquiry = props.snapshot.data.inquiries.find((item) => item.id === id);
                        if (!inquiry) return null;
                        return (
                          <button
                            className={`inquiry-chip ${props.activeInquiry === id ? "active" : ""}`}
                            disabled={busy}
                            key={id}
                            onClick={() => runDrawerInquiry(inquiry.label)}
                            type="button"
                          >
                            <span />
                            {inquiry.label}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="results-panel">
          {props.pendingOperation ? (
            <PendingResult operation={props.pendingOperation} />
          ) : !props.result ? (
            <EmptyState title="Run an Oracle inquiry" text="Ask a question or launch one of the 23 README prompts from the drawer." />
          ) : (
            <>
              <div className="result-header">
                <div>
                  <div className="eyebrow">Result Set</div>
                  <h2>{props.result.headerLabel}</h2>
                  <p>{props.result.note}</p>
                </div>
                <span className="count">{props.result.count} records</span>
              </div>
              {props.result.hasAnswer && props.result.answer && <MarkdownAnswer source={props.result.answer} />}
              {props.result.retrieval && <RetrievalTrace retrieval={props.result.retrieval} />}
              {props.result.isGraph && props.graph && (
                <GraphView
                  snapshot={props.snapshot}
                  graph={props.graph}
                  graphProperty={props.graphProperty}
                  onGraphProperty={props.onGraphProperty}
                />
              )}
              <div className="cards">
                {props.result.cards.map((card) => {
                  const selection = selectionForCard(props.snapshot, card);
                  return (
                    <ResultCardView
                      card={card}
                      key={`${card.type}-${card.key}`}
                      selectable={Boolean(selection)}
                      onClick={() => {
                        if (selection) props.onSelect(selection);
                      }}
                    />
                  );
                })}
              </div>
            </>
          )}
        </section>

        <section className="detail-panel">
          {props.detail ? <DetailView detail={props.detail} /> : <EmptyState title="No entity selected" text="Choose a result card to inspect its relationships, lineage, and citations." />}
        </section>
      </div>
    </div>
  );
}

function PendingResult({ operation }: { operation: PendingOperation }) {
  return (
    <div className="pending-result" aria-busy="true" aria-live="polite">
      <div className="pending-result-head">
        <div className="pending-orbit">
          <span />
        </div>
        <div>
          <div className="eyebrow">Request in progress</div>
          <h2>{operation.title}</h2>
          <p>{operation.query}</p>
        </div>
      </div>
      <p className="pending-detail">{operation.detail}</p>
      <div className="pending-steps">
        {operation.steps.map((step, index) => (
          <span key={step}>
            <i>{index + 1}</i>
            {step}
          </span>
        ))}
      </div>
      <div className="pending-skeleton" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}

type MarkdownBlock =
  | { type: "heading"; depth: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "ul" | "ol"; items: string[] };

function MarkdownAnswer({ source }: { source: string }) {
  return (
    <div className="synthesis markdown-answer">
      {parseMarkdownBlocks(source).map((block, index) => renderMarkdownBlock(block, index))}
    </div>
  );
}

function renderMarkdownBlock(block: MarkdownBlock, index: number): ReactNode {
  if (block.type === "heading") {
    const Heading = block.depth <= 2 ? "h3" : "h4";
    return <Heading key={`heading-${index}`}>{renderInlineMarkdown(block.text, `heading-${index}`)}</Heading>;
  }

  if (block.type === "paragraph") {
    return <p key={`paragraph-${index}`}>{renderInlineMarkdown(block.text, `paragraph-${index}`)}</p>;
  }

  const List = block.type === "ol" ? "ol" : "ul";
  return (
    <List key={`list-${index}`}>
      {block.items.map((item, itemIndex) => (
        <li key={`${block.type}-${index}-${itemIndex}`}>{renderInlineMarkdown(item, `${block.type}-${index}-${itemIndex}`)}</li>
      ))}
    </List>
  );
}

function parseMarkdownBlocks(source: string): MarkdownBlock[] {
  const lines = normalizeMarkdown(source).split("\n").map((line) => line.trimEnd());
  const blocks: MarkdownBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      blocks.push({ type: "heading", depth: heading[1].length, text: heading[2].trim() });
      index += 1;
      continue;
    }

    if (/^\s*[-*]\s+(.+)$/.test(line)) {
      const { items, nextIndex } = readListItems(lines, index, "ul");
      blocks.push({ type: "ul", items });
      index = nextIndex;
      continue;
    }

    if (/^\s*\d+[.)]\s+(.+)$/.test(line)) {
      const { items, nextIndex } = readListItems(lines, index, "ol");
      blocks.push({ type: "ol", items });
      index = nextIndex;
      continue;
    }

    const paragraph: string[] = [];
    while (index < lines.length && lines[index].trim() && !isMarkdownBlockStart(lines[index])) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    blocks.push({ type: "paragraph", text: paragraph.join(" ") });
  }

  return blocks;
}

function normalizeMarkdown(source: string): string {
  return source
    .replace(/\r\n?/g, "\n")
    .replace(/([:.;)])\s+-\s+(?=\*\*|[A-Za-z0-9])/g, "$1\n- ")
    .replace(/\s+-\s+(?=\*\*)/g, "\n- ");
}

function readListItems(lines: string[], start: number, type: "ul" | "ol"): { items: string[]; nextIndex: number } {
  const pattern = type === "ul" ? /^\s*[-*]\s+(.+)$/ : /^\s*\d+[.)]\s+(.+)$/;
  const items: string[] = [];
  let index = start;

  while (index < lines.length) {
    const match = lines[index].match(pattern);
    if (!match) break;

    let item = match[1].trim();
    index += 1;

    while (index < lines.length && lines[index].trim() && !isMarkdownBlockStart(lines[index])) {
      item = `${item} ${lines[index].trim()}`;
      index += 1;
    }

    items.push(item);
  }

  return { items, nextIndex: index };
}

function isMarkdownBlockStart(line: string): boolean {
  return /^(#{1,4})\s+/.test(line) || /^\s*[-*]\s+/.test(line) || /^\s*\d+[.)]\s+/.test(line);
}

function renderInlineMarkdown(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*([^*]+?)\*\*|`([^`]+?)`|\[([^\]]+?)\]\((https?:\/\/[^)\s]+)\)|\[[Rr]\d+\])/g;
  let cursor = 0;
  let tokenIndex = 0;

  for (const match of text.matchAll(pattern)) {
    const start = match.index ?? 0;
    if (start > cursor) nodes.push(text.slice(cursor, start));

    const raw = match[0];
    const key = `${keyPrefix}-${tokenIndex}`;
    if (match[2]) {
      nodes.push(<strong key={key}>{match[2]}</strong>);
    } else if (match[3]) {
      nodes.push(<code key={key}>{match[3]}</code>);
    } else if (match[4] && match[5]) {
      nodes.push(
        <a href={match[5]} key={key} rel="noreferrer" target="_blank">
          {match[4]}
        </a>
      );
    } else if (/^\[[Rr]\d+\]$/.test(raw)) {
      nodes.push(<span className="md-citation" key={key}>{raw.toUpperCase()}</span>);
    } else {
      nodes.push(raw);
    }

    cursor = start + raw.length;
    tokenIndex += 1;
  }

  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}

function Registry(props: {
  snapshot: CommandCenterSnapshot;
  selection: string;
  onSelect: (agentId: string) => void;
  onAdvance: (agentId: string, status: AgentStatus) => void;
  onRegisterExternal: () => void;
  onMarketplace: () => void;
}) {
  const agent = props.snapshot.data.agents.find((item) => item.id === props.selection) ?? props.snapshot.data.agents[0];
  const status = agentStatus(props.snapshot, agent.id);
  const actions = agentActions(props.snapshot, agent.id);
  const metrics = getRegistryMetrics(props.snapshot);
  const teamKitSource = props.snapshot.data.sourceSnapshots?.find((source) => source.id === "soofi-team-kit");
  const elephantSource = props.snapshot.data.sourceSnapshots?.find((source) => source.id === "elephant-skills");
  return (
    <div className="registry-grid">
      <section className="panel">
        <div className="section-title">
          <div>
            <div className="eyebrow">Agent Registry</div>
            <h2>Discovered agents</h2>
            <p>
              Parsed {teamKitSource?.agents ?? props.snapshot.data.agents.length} agents and {teamKitSource?.skills ?? 0} skills from Soofi team-kit,
              plus {elephantSource?.skills ?? 0} Elephant Oracle skills.
            </p>
          </div>
          <div className="title-actions">
            <button className="action blue" onClick={props.onRegisterExternal}>
              <UserPlus size={15} />
              Register external
            </button>
            <span className="count">{props.snapshot.data.agents.length} agents</span>
          </div>
        </div>
        <div className="agent-list">
          <div className="registry-metrics">
            <Metric value={String(metrics.totalAgents)} label="agents" />
            <Metric value={String(metrics.statuses.Certified)} label="certified" />
            <Metric value={String(metrics.hiddenMarketplaceAgents)} label="hidden" />
            <Metric value={String(metrics.networkParticipants)} label="network" />
          </div>
          {props.snapshot.data.agents.map((item) => (
            <button className={`agent-row ${props.selection === item.id ? "active" : ""}`} key={item.id} onClick={() => props.onSelect(item.id)}>
              <AgentAvatar agent={item} />
              <span>
                <strong>{item.display}</strong>
                <small>{item.role}</small>
              </span>
              <StatusPill label={agentStatus(props.snapshot, item.id)} status={agentStatus(props.snapshot, item.id)} />
            </button>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="agent-detail-head">
          <AgentAvatar agent={agent} large />
          <div>
            <h2>{agent.display}</h2>
            <p>{agent.role} · v{agent.id === "oracle" ? "1.0.0" : agent.version}</p>
          </div>
          <StatusPill label={status} status={status} />
        </div>
        <div className="lifecycle">
          {AGENT_STATUSES.map((item) => (
            <span className={item === status ? "active" : ""} key={item}>
              {item}
            </span>
          ))}
        </div>
        <p className="summary">{agent.summary}</p>
        <div className="meta-grid">
          <Info label="Runtime" value={agent.runtime} />
          <Info label="Owner" value={agent.owner ?? agent.reviewer ?? "source snapshot"} />
          <Info label="Docs" value={agent.docs} />
          <Info label="Invocation" value={agent.triggers} />
          <Info label="Certified" value={props.snapshot.registry.certDates[agent.id] ?? "—"} />
        </div>
        <TagList label="Capabilities" values={agent.capabilities?.length ? agent.capabilities : agent.skills} />
        <TagList label="Inputs" values={agent.inputs?.length ? agent.inputs : ["task prompt", "source records", "operator context"]} />
        <TagList label="Outputs" values={agent.outputs?.length ? agent.outputs : ["agent response", "evidence trail", "operator handoff"]} />
        <TagList label="Skills" values={agent.skills} />
        <TagList label="Dependencies" values={agent.deps.length ? agent.deps : ["—"]} />
        <TagList label="Tools & Data" values={[...(agent.connectedTools ?? []), ...(agent.dataSources ?? [])].length ? [...(agent.connectedTools ?? []), ...(agent.dataSources ?? [])] : [agent.sourceRepo ?? "Soofi source snapshot"]} />
        <div className="actions">
          {actions.map((action) => (
            <button className={`action ${action.tone}`} key={action.label} onClick={() => props.onAdvance(agent.id, action.to)}>
              {action.label}
            </button>
          ))}
          {status === "Certified" && (
            <button className="action green" onClick={props.onMarketplace}>
              View Marketplace
            </button>
          )}
        </div>
        <NetworkLineage snapshot={props.snapshot} agent={agent} status={status} />
        <CandidateEvaluation snapshot={props.snapshot} agent={agent} status={status} />
      </section>
    </div>
  );
}

function AgentAvatar({ agent, large = false }: { agent: AgentRecord; large?: boolean }) {
  const fallback = agent.iconLabel ?? agent.display[0]?.toUpperCase() ?? "?";
  const className = `avatar${large ? " large" : ""}${agent.iconUrl ? " image" : ""}`;
  return (
    <span className={className} title={agent.iconLabel ?? agent.display} aria-label={`${agent.display} icon`}>
      {agent.iconUrl ? (
        <img
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          src={agent.iconUrl}
          onError={(event) => {
            event.currentTarget.parentElement?.classList.add("broken");
          }}
        />
      ) : null}
      <span className="avatar-fallback">{fallback}</span>
    </span>
  );
}

function ManualRegistrationModal(props: {
  registration: ManualAgentRegistration;
  pending: boolean;
  onChange: (registration: ManualAgentRegistration) => void;
  onClose: () => void;
  onReset: () => void;
  onSubmit: (registration: ManualAgentRegistration) => void;
}) {
  const registration = props.registration;
  const canSubmit = Boolean(registration.display.trim() && registration.role.trim() && registration.owner.trim() && registration.summary.trim() && registration.triggers.trim());

  function setField<K extends keyof ManualAgentRegistration>(field: K, value: ManualAgentRegistration[K]) {
    props.onChange({ ...registration, [field]: value });
  }

  function setListField(field: ManualListField, value: string) {
    setField(field, parseManualList(value) as ManualAgentRegistration[typeof field]);
  }

  return (
    <div className="modal-backdrop">
      <section className="manual-modal" role="dialog" aria-modal="true" aria-labelledby="manual-registration-title">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (canSubmit && !props.pending) props.onSubmit(normalizeManualRegistration(registration));
          }}
        >
          <div className="manual-modal-head">
            <div>
              <div className="eyebrow">Manual Registration</div>
              <h2 id="manual-registration-title">Register external agent</h2>
              <p>Prefilled with a non-GitHub agent; edit anything before submitting it into the certification lifecycle.</p>
            </div>
            <button type="button" className="action gray" disabled={props.pending} onClick={props.onClose}>
              Close
            </button>
          </div>

          <div className="manual-form-grid">
            <ManualTextField label="Agent ID" value={registration.id ?? ""} disabled={props.pending} onChange={(value) => setField("id", value)} />
            <ManualTextField label="Display Name" required value={registration.display} disabled={props.pending} onChange={(value) => setField("display", value)} />
            <ManualTextField label="Role" required value={registration.role} disabled={props.pending} onChange={(value) => setField("role", value)} />
            <ManualTextField label="Owner" required value={registration.owner} disabled={props.pending} onChange={(value) => setField("owner", value)} />
            <ManualTextField label="Version" value={registration.version ?? ""} disabled={props.pending} onChange={(value) => setField("version", value)} />
            <ManualTextField label="Runtime" value={registration.runtime ?? ""} disabled={props.pending} onChange={(value) => setField("runtime", value)} />
            <ManualTextField label="Invocation" required value={registration.triggers} disabled={props.pending} onChange={(value) => setField("triggers", value)} />
            <ManualTextField label="Docs" value={registration.docs ?? ""} disabled={props.pending} onChange={(value) => setField("docs", value)} />
            <ManualTextArea label="Summary" required rows={3} value={registration.summary} disabled={props.pending} onChange={(value) => setField("summary", value)} />
            <ManualTextArea label="Usage" rows={3} value={registration.usage ?? ""} disabled={props.pending} onChange={(value) => setField("usage", value)} />
            <ManualTextArea label="Install Guidance" rows={3} value={registration.install ?? ""} disabled={props.pending} onChange={(value) => setField("install", value)} />
            <ManualListField label="Skills" value={formatManualList(registration.skills)} disabled={props.pending} onChange={(value) => setListField("skills", value)} />
            <ManualListField label="Dependencies" value={formatManualList(registration.deps)} disabled={props.pending} onChange={(value) => setListField("deps", value)} />
            <ManualListField label="Capabilities" value={formatManualList(registration.capabilities)} disabled={props.pending} onChange={(value) => setListField("capabilities", value)} />
            <ManualListField label="Inputs" value={formatManualList(registration.inputs)} disabled={props.pending} onChange={(value) => setListField("inputs", value)} />
            <ManualListField label="Outputs" value={formatManualList(registration.outputs)} disabled={props.pending} onChange={(value) => setListField("outputs", value)} />
            <ManualListField label="Tools" value={formatManualList(registration.connectedTools)} disabled={props.pending} onChange={(value) => setListField("connectedTools", value)} />
            <ManualListField label="Data Sources" value={formatManualList(registration.dataSources)} disabled={props.pending} onChange={(value) => setListField("dataSources", value)} />
            <ManualListField label="Network Interactions" value={formatManualList(registration.networkInteractions)} disabled={props.pending} onChange={(value) => setListField("networkInteractions", value)} />
          </div>

          <div className="manual-modal-actions">
            <button type="button" className="action gray" disabled={props.pending} onClick={props.onReset}>
              Reset defaults
            </button>
            <button type="submit" className="action blue" disabled={props.pending || !canSubmit}>
              {props.pending ? "Registering..." : "Submit registration"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function ManualTextField(props: { label: string; value: string; disabled: boolean; required?: boolean; onChange: (value: string) => void }) {
  return (
    <label className="manual-field">
      <span>{props.label}</span>
      <input required={props.required} disabled={props.disabled} value={props.value} onChange={(event) => props.onChange(event.target.value)} />
    </label>
  );
}

function ManualTextArea(props: { label: string; value: string; disabled: boolean; rows?: number; required?: boolean; onChange: (value: string) => void }) {
  return (
    <label className="manual-field wide">
      <span>{props.label}</span>
      <textarea required={props.required} disabled={props.disabled} rows={props.rows ?? 4} value={props.value} onChange={(event) => props.onChange(event.target.value)} />
    </label>
  );
}

function ManualListField(props: { label: string; value: string; disabled: boolean; onChange: (value: string) => void }) {
  return (
    <label className="manual-field">
      <span>{props.label}</span>
      <textarea disabled={props.disabled} rows={4} value={props.value} onChange={(event) => props.onChange(event.target.value)} />
    </label>
  );
}

function parseManualList(value: string) {
  return value.split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
}

function formatManualList(value?: string[]) {
  return value?.join("\n") ?? "";
}

function normalizeManualRegistration(registration: ManualAgentRegistration): ManualAgentRegistration {
  return {
    ...registration,
    id: registration.id?.trim() || undefined,
    display: registration.display.trim(),
    role: registration.role.trim(),
    owner: registration.owner.trim(),
    version: registration.version?.trim() || undefined,
    summary: registration.summary.trim(),
    triggers: registration.triggers.trim(),
    runtime: registration.runtime?.trim() || undefined,
    docs: registration.docs?.trim() || undefined,
    usage: registration.usage?.trim() || undefined,
    install: registration.install?.trim() || undefined,
    skills: registration.skills?.map((item) => item.trim()).filter(Boolean),
    deps: registration.deps?.map((item) => item.trim()).filter(Boolean),
    capabilities: registration.capabilities?.map((item) => item.trim()).filter(Boolean),
    inputs: registration.inputs?.map((item) => item.trim()).filter(Boolean),
    outputs: registration.outputs?.map((item) => item.trim()).filter(Boolean),
    dataSources: registration.dataSources?.map((item) => item.trim()).filter(Boolean),
    connectedTools: registration.connectedTools?.map((item) => item.trim()).filter(Boolean),
    networkInteractions: registration.networkInteractions?.map((item) => item.trim()).filter(Boolean)
  };
}

function Marketplace({ snapshot }: { snapshot: CommandCenterSnapshot }) {
  const agents = marketplaceAgents(snapshot);
  return (
    <section className="panel fill">
      <div className="section-title">
        <div>
          <div className="eyebrow">Certified Marketplace</div>
          <h2>Publishable agents</h2>
          <p>Only Certified agents are listed. {hiddenAgents(snapshot)} uncertified agents are hidden by the governance gate.</p>
        </div>
        <Store size={28} />
      </div>
      <div className="market-grid">
        {agents.map((agent) => (
          <article className="market-card" key={agent.id}>
            <div className="agent-detail-head compact">
              <AgentAvatar agent={agent} />
              <div>
                <h3>{agent.display}</h3>
                <p>{agent.role}</p>
              </div>
              <BadgeCheck size={18} />
            </div>
            <p>{agent.summary}</p>
            <Info label="Usage" value={agent.triggers} />
            <Info label="Install" value={agent.install ?? "Invoke through the Soofi team-kit agent catalog after certification."} />
            <Info label="Run History" value={`${agent.runCount ?? 0} network runs · last ${agent.lastRunAt ?? "source snapshot"}`} />
            <TagList label="Skills" values={agent.skills} />
            <TagList label="Integration" values={[...(agent.connectedTools ?? []), ...(agent.dataSources ?? [])].length ? [...(agent.connectedTools ?? []), ...(agent.dataSources ?? [])] : [agent.runtime]} />
            <footer>certified {snapshot.registry.certDates[agent.id] ?? agent.certifiedDate}</footer>
          </article>
        ))}
      </div>
    </section>
  );
}

function Evidence({ runs, selected, onSelect }: { runs: EvidenceRun[]; selected: EvidenceRun | null; onSelect: (run: EvidenceRun) => void }) {
  return (
    <div className="evidence-grid">
      <section className="panel">
        <div className="section-title">
          <div>
            <div className="eyebrow">Evidence Ledger</div>
            <h2>Query provenance</h2>
            <p>Each run stores query, result, cited sources, responsible agent, and certification state at execution time.</p>
          </div>
          <Network size={28} />
        </div>
        {!runs.length ? (
          <EmptyState title="No runs yet" text="Run an Intelligence inquiry to populate this ledger." />
        ) : (
          <div className="evidence-list">
            {runs.map((run) => (
              <button className={`evidence-row ${selected?.id === run.id ? "active" : ""}`} key={run.id} onClick={() => onSelect(run)}>
                <strong>{run.query}</strong>
                <span>{run.ts} · {run.count} records · agent {run.agentId}</span>
                <StatusPill label={run.cert} status={run.cert} />
              </button>
            ))}
          </div>
        )}
      </section>
      <section className="panel run-detail-panel">
        {selected ? (
          <>
            <div className="section-title run-detail-head">
              <div>
                <div className="eyebrow">Run Detail</div>
                <h2>{selected.query}</h2>
              </div>
              <StatusPill label={selected.cert} status={selected.cert} />
            </div>
            <div className="run-detail-body">
              <div className="run-info-stack">
                <Info label="Summary" value={selected.summary} />
                <Info label="Produced by" value={`${selected.agentId} · evaluated by ${selected.evaluatorId}`} />
                <Info label="Certification" value={selected.certifierId ? `${selected.certifierId} · ${selected.certifiedAt}` : "not certified at run time"} />
                <Info label="Sources" value={selected.sources.length ? selected.sources.join(" · ") : "—"} />
                {selected.retrieval && <Info label="Retrieval" value={`${selected.retrieval.provider} · ${selected.retrieval.status} · ${selected.retrieval.embeddingModel ?? "no embedding"} -> ${selected.retrieval.answerModel ?? "no answer model"}`} />}
              </div>
              {selected.retrieval?.retrieved.length ? (
                <div className="chunk-list">
                  {selected.retrieval.retrieved.map((chunk) => (
                    <span key={chunk.id}>{chunk.title} · {chunk.score.toFixed(3)}</span>
                  ))}
                </div>
              ) : null}
              <div className="citation-list run-citations">
                {selected.citations.map((source) => (
                  <a href={source.url} key={source.url} target="_blank" rel="noreferrer">
                    <strong>{source.system}</strong>
                    <span>{source.entity} · collected {source.collected} · refreshed {source.refreshed}</span>
                  </a>
                ))}
              </div>
            </div>
          </>
        ) : (
          <EmptyState title="Select a run" text="The ledger keeps provisional and certified runs separate." />
        )}
      </section>
    </div>
  );
}

function RetrievalTrace({ retrieval }: { retrieval: NonNullable<InquiryResult["retrieval"]> }) {
  return (
    <div className={`retrieval-trace ${retrieval.status}`}>
      <div>
        <div className="eyebrow">RAG Trace</div>
        <strong>{retrieval.provider} · {retrieval.mode} · {retrieval.status}</strong>
        <span>{`${retrieval.embeddingModel ?? "no embedding model"} -> ${retrieval.answerModel ?? "no answer model"} · ${retrieval.citationCount} citations`}</span>
      </div>
      {retrieval.errorCode && <em>{retrieval.errorCode}</em>}
      {retrieval.retrieved.length ? (
        <div className="chunk-list">
          {retrieval.retrieved.map((chunk) => (
            <span key={chunk.id}>{chunk.title} · {chunk.score.toFixed(3)}</span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function NetworkLineage({ snapshot, agent, status }: { snapshot: CommandCenterSnapshot; agent: AgentRecord; status: AgentStatus }) {
  const source = snapshot.data.sourceSnapshots?.find((item) => item.id === "soofi-team-kit");
  const latestDecision = latestAgentDecision(snapshot, agent.id);
  const lineage = [
    { label: "Source", value: sourceLineage(agent) },
    { label: "Commit", value: agent.sourceCommit ? shortCommit(agent.sourceCommit) : source?.commit ? shortCommit(source.commit) : "manual registration" },
    { label: "Skills", value: joinLimited(agent.skills, "No skills declared") },
    { label: "Dependencies", value: joinLimited(agent.deps, "No dependencies declared") },
    { label: "Tools & Data", value: joinLimited([...(agent.connectedTools ?? []), ...(agent.dataSources ?? [])], agent.sourceRepo ?? "No tools declared") },
    { label: "Network Role", value: joinLimited(agent.networkInteractions ?? [], inferredNetworkRole(agent, status)) },
    { label: "Runtime", value: agent.runtime },
    { label: "Latest Decision", value: latestDecision ? `${latestDecision.to} by ${latestDecision.reviewer} · score ${latestDecision.evaluationScore}` : `${status} · no certification decision yet` }
  ];
  return (
    <section className="lineage-panel">
      <div className="eyebrow">Network Lineage</div>
      <h3>{agent.display} lineage</h3>
      <p>
        {agent.source === "self"
          ? `Operator-submitted agent owned by ${agent.owner ?? "the current reviewer"} and tracked through the same certification lifecycle.`
          : `${agent.sourcePath ?? "Team-kit source"} parsed from ${source?.agents ?? snapshot.data.agents.length} discovered Soofi agents and ${source?.skills ?? 0} skills.`}
      </p>
      <div className="lineage-grid">
        {lineage.map((item) => (
          <Info key={item.label} label={item.label} value={item.value} />
        ))}
      </div>
    </section>
  );
}

function CandidateEvaluation({ snapshot, agent, status }: { snapshot: CommandCenterSnapshot; agent: AgentRecord; status: AgentStatus }) {
  const latestDecision = latestAgentDecision(snapshot, agent.id);
  const sourceReady = agent.source === "self" ? Boolean(agent.owner && agent.docs) : Boolean(agent.sourceRepo && agent.sourcePath && agent.sourceCommit);
  const metadataReady = Boolean(agent.summary && agent.runtime && agent.triggers && agent.docs);
  const integrationCount = agent.skills.length + agent.deps.length + (agent.connectedTools?.length ?? 0) + (agent.dataSources?.length ?? 0);
  const marketplaceReady = status === "Certified";
  const rows = [
    {
      label: "Metadata",
      state: metadataReady ? "pass" : "warn",
      text: metadataReady ? `${agent.display} declares runtime, docs, trigger, and purpose` : "Missing runtime, docs, trigger, or summary"
    },
    {
      label: "Source Provenance",
      state: sourceReady ? "pass" : "warn",
      text: sourceReady ? sourceEvaluation(agent) : "Needs owner plus docs, or team-kit repo, path, and commit"
    },
    {
      label: "Integration Surface",
      state: integrationCount >= 2 ? "pass" : "warn",
      text: `${agent.skills.length} skills · ${agent.deps.length} deps · ${(agent.connectedTools?.length ?? 0) + (agent.dataSources?.length ?? 0)} tools/data`
    },
    {
      label: "Certification",
      state: marketplaceReady ? "pass" : "warn",
      text: latestDecision ? `${status} after ${latestDecision.outcome}; score ${latestDecision.evaluationScore}` : `${status}; Marketplace remains blocked until Certified`
    }
  ];
  return (
    <section className="evaluation-panel">
      <div className="eyebrow">Candidate Evaluation</div>
      <h3>{agent.display} certification fit</h3>
      <div className="evaluation-grid">
        {rows.map((row) => (
          <div className={row.state} key={row.label}>
            <strong>{row.label}</strong>
            <span>{row.text}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function latestAgentDecision(snapshot: CommandCenterSnapshot, agentId: string) {
  return [...snapshot.registry.history].reverse().find((decision) => decision.agentId === agentId);
}

function sourceLineage(agent: AgentRecord) {
  if (agent.source === "self") return agent.sourcePath ?? "operator-submitted";
  return `${compactRepo(agent.sourceRepo)} · ${agent.sourcePath ?? "source path missing"}`;
}

function sourceEvaluation(agent: AgentRecord) {
  if (agent.source === "self") return `${agent.owner ?? "operator"} submitted ${agent.docs}`;
  return `${agent.sourcePath ?? "source path missing"} at ${shortCommit(agent.sourceCommit)}`;
}

function inferredNetworkRole(agent: AgentRecord, status: AgentStatus) {
  if (agent.id === "oracle") return "owns Oracle property intelligence and query DB contract";
  if (agent.skills.some((skill) => skill.includes("rag"))) return "supports retrieval and synthesis workflows";
  if (agent.skills.some((skill) => skill.includes("frontend") || skill.includes("backend"))) return "supports application implementation";
  if (status === "Certified") return "certified marketplace participant";
  return "pending network role verification";
}

function compactRepo(repo?: string) {
  return repo?.replace("https://github.com/", "") ?? "manual source";
}

function shortCommit(commit?: string) {
  return commit ? commit.slice(0, 8) : "not recorded";
}

function joinLimited(values: string[], fallback: string, limit = 4) {
  if (!values.length) return fallback;
  const visible = values.slice(0, limit).join(" · ");
  const hidden = values.length - limit;
  return hidden > 0 ? `${visible} · +${hidden} more` : visible;
}

function GraphView(props: {
  snapshot: CommandCenterSnapshot;
  graph: ReturnType<typeof getRelationshipGraph>;
  graphProperty: string;
  onGraphProperty: (propertyId: string) => void;
}) {
  return (
    <div className="graph">
      <select value={props.graphProperty} onChange={(event) => props.onGraphProperty(event.target.value)}>
        {props.snapshot.data.properties.map((property) => (
          <option value={property.id} key={property.id}>
            {property.address} · {property.city}
          </option>
        ))}
      </select>
      <div className="graph-center">
        <strong>{props.graph.center.title}</strong>
        <span>{props.graph.center.sub}</span>
      </div>
      <div className="graph-clusters">
        {props.graph.clusters.map((cluster) => (
          <div className="graph-cluster" key={cluster.title}>
            <div className="eyebrow">{cluster.title}</div>
            {cluster.nodes.length ? cluster.nodes.map((node) => <Info key={`${node.name}-${node.role}`} label={node.name} value={node.role} />) : <p>none linked</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

function ResultCardView({ card, selectable, onClick }: { card: ResultCard; selectable: boolean; onClick: () => void }) {
  return (
    <button className={`result-card ${selectable ? "" : "unselectable"}`} aria-disabled={!selectable} onClick={onClick}>
      <div className="card-top">
        <div>
          <strong>{card.title}</strong>
          <span>{card.subtitle}</span>
        </div>
        <div className="badge-row">
          {card.badges.map((item) => (
            <span style={{ background: item.bg, color: item.fg, borderColor: item.bd }} key={item.label}>
              {item.label}
            </span>
          ))}
        </div>
      </div>
      <div className="meta-row">
        {card.metas.map((item) => (
          <Info label={item.k} value={item.v} key={item.k} />
        ))}
      </div>
      <footer>⛓ {card.cite} cited</footer>
    </button>
  );
}

function DetailView({ detail }: { detail: EntityDetail }) {
  return (
    <div className="detail">
      <div className="kind">{detail.type.toUpperCase()}</div>
      <h2>{detail.title}</h2>
      <p>{detail.subtitle}</p>
      <div className="badge-row">
        {detail.signals.map((signal) => (
          <span style={{ background: signal.bg, color: signal.fg, borderColor: signal.bd }} key={signal.label}>
            {signal.label}
          </span>
        ))}
      </div>
      {detail.sections.map((section) => (
        <section className="detail-section" key={section.title}>
          <div className="eyebrow">{section.title}</div>
          {section.empty ? (
            <p className="muted">none linked</p>
          ) : (
            section.rows.map((row, index) => (
              <div className="detail-row" key={`${section.title}-${index}`}>
                <div>
                  <strong>{row.primary}</strong>
                  {row.secondary && <span>{row.secondary}</span>}
                </div>
                <div>
                  {row.value && <strong>{row.value}</strong>}
                  {row.meta && <span>{row.meta}</span>}
                  {row.tag && <em className={`mini-tag ${row.tone ?? "gray"}`}>{row.tag}</em>}
                </div>
              </div>
            ))
          )}
        </section>
      ))}
      <section className="detail-section">
        <div className="eyebrow">Citations</div>
        <div className="citation-list">
          {detail.citations.map((source) => (
            <a href={source.url} key={source.url} target="_blank" rel="noreferrer">
              <strong>{source.system}</strong>
              <span>collected {source.collected} · refreshed {source.refreshed}</span>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}

function StatusPill({ label, status }: { label: string; status: string }) {
  const style = statusTone(status as never);
  return (
    <span className="status-pill" style={{ background: style.bg, color: style.fg, borderColor: style.bd }}>
      {label}
    </span>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="metric">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function DataPlaneCard({ dataPlane, lastRefresh }: { dataPlane: DataPlaneStatus; lastRefresh: string }) {
  const label = dataPlane.activeMode === "elephant-query-db" ? "Live Elephant Query DB" : dataPlane.server ? "Server fixture fallback" : "Static fixture corpus";
  const state = dataPlane.activeMode === "elephant-query-db" ? "live" : dataPlane.fallbackReason ? "fallback" : "fixture";
  const coverage = dataPlane.coverage
    ? `${dataPlane.coverage.properties ?? 0} parcels · ${dataPlane.coverage.permits ?? 0} permits`
    : "schema contract pending";
  return (
    <div className="data-card">
      <div className="eyebrow">Data Plane</div>
      <div className={`data-online ${state}`}>
        <span />
        {label}
      </div>
      <p>{dataPlane.message}</p>
      {dataPlane.fallbackReason && <p className="data-warning">{dataPlane.fallbackReason}</p>}
      <code>{coverage}</code>
      <code>refreshed {lastRefresh}</code>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="info">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function TagList({ label, values }: { label: string; values: string[] }) {
  return (
    <div className="tag-list">
      <div className="eyebrow">{label}</div>
      <div>
        {values.map((value) => (
          <span key={value}>{value}</span>
        ))}
      </div>
    </div>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="empty">
      <Boxes size={26} />
      <strong>{title}</strong>
      <span>{text}</span>
    </div>
  );
}

function cleanStructuredQuery(query: StructuredQuery): StructuredQuery {
  return {
    entity: query.entity,
    county: query.county?.trim() || undefined,
    municipality: query.municipality?.trim() || undefined,
    permitType: query.permitType?.trim() || undefined,
    contractor: query.contractor?.trim() || undefined,
    propertyClass: query.propertyClass?.trim() || undefined,
    businessType: query.businessType?.trim() || undefined,
    status: query.status?.trim() || undefined,
    dateFrom: query.dateFrom?.trim() || undefined,
    dateTo: query.dateTo?.trim() || undefined,
    limit: query.limit
  };
}

function structuredQuerySummary(query: StructuredQuery): string {
  const parts = [
    query.entity ? `entity:${query.entity}` : null,
    query.municipality ? query.municipality : null,
    query.permitType ? `permit:${query.permitType}` : null,
    query.propertyClass ? `class:${query.propertyClass}` : null,
    query.businessType ? `business:${query.businessType}` : null,
    query.status ? `status:${query.status}` : null,
    query.contractor ? `contractor:${query.contractor}` : null
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "All Oracle entities";
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function firstSelectable(snapshot: CommandCenterSnapshot, result: InquiryResult | null): { type: EntityType; id: string } | null {
  if (!result) return null;
  if (result.isGraph) {
    const property = snapshot.data.properties.find((item) => item.id === "p10") ?? snapshot.data.properties[0];
    return property ? { type: "property", id: property.id } : null;
  }
  for (const card of result.cards) {
    const selection = selectionForCard(snapshot, card);
    if (selection) return selection;
  }
  return null;
}

function selectionForCard(snapshot: CommandCenterSnapshot, card: ResultCard): { type: EntityType; id: string } | null {
  if (card.type !== "project") {
    return canResolveDetail(snapshot, card.type, card.key) ? { type: card.type, id: card.key } : null;
  }
  const property = snapshot.data.properties.find((item) => item.permits.some((permit) => permit.id === card.key));
  return property && canResolveDetail(snapshot, "property", property.id) ? { type: "property", id: property.id } : null;
}

function safeGetDetail(snapshot: CommandCenterSnapshot, type: EntityType, id: string): EntityDetail | null {
  try {
    return getDetail(snapshot, type, id);
  } catch {
    return null;
  }
}

function safeGetRelationshipGraph(snapshot: CommandCenterSnapshot, propertyId: string) {
  try {
    return getRelationshipGraph(snapshot, propertyId);
  } catch {
    return null;
  }
}

function canResolveDetail(snapshot: CommandCenterSnapshot, type: EntityType, id: string): boolean {
  if (type === "property") {
    const property = snapshot.data.properties.find((item) => item.id === id);
    return Boolean(property && snapshot.data.owners.some((owner) => owner.id === property.owner));
  }
  if (type === "contractor") return snapshot.data.contractors.some((item) => item.id === id);
  if (type === "business") {
    const business = snapshot.data.businesses.find((item) => item.id === id);
    return Boolean(business && business.locations.every((propertyId) => snapshot.data.properties.some((property) => property.id === propertyId)));
  }
  if (type === "owner") {
    const owner = snapshot.data.owners.find((item) => item.id === id);
    return Boolean(owner && owner.props.every((propertyId) => snapshot.data.properties.some((property) => property.id === propertyId)));
  }
  if (type === "tenant") {
    const tenant = snapshot.data.tenants.find((item) => item.id === id);
    return Boolean(
      tenant &&
        tenant.locations.every((propertyId) => snapshot.data.properties.some((property) => property.id === propertyId)) &&
        tenant.businesses.every((businessId) => snapshot.data.businesses.some((business) => business.id === businessId))
    );
  }
  return false;
}
