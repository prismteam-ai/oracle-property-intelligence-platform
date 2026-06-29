export type InquiryKind = "demo" | "stretch";

export type InquiryTarget =
  | "property"
  | "contractor"
  | "business"
  | "tenant"
  | "owner"
  | "project"
  | "neighborhood"
  | "graph"
  | "rag";

export type InquiryDef = {
  id: string;
  kind: InquiryKind;
  ordinal: number;
  label: string;
  question: string;
  keywords: string[];
  target: InquiryTarget;
};

export function inquiryDeepLink(inquiry: InquiryDef): string {
  return `/insights#${inquiry.id}`;
}

export const INQUIRIES: InquiryDef[] = [
  {
    id: "props-multi-open-permit",
    kind: "demo",
    ordinal: 1,
    label: "Properties with >1 open permit",
    question: "Show all properties with more than one open permit.",
    keywords: ["open permit", "multiple permits", "more than one permit", "property"],
    target: "property",
  },
  {
    id: "props-open-roofing",
    kind: "demo",
    ordinal: 2,
    label: "Properties with open roofing permits",
    question: "Show all properties with open roofing permits.",
    keywords: ["open roofing", "roof permit", "roofing"],
    target: "property",
  },
  {
    id: "props-open-electrical",
    kind: "demo",
    ordinal: 3,
    label: "Properties with open electrical permits",
    question: "Show all properties with open electrical permits.",
    keywords: ["open electrical", "electrical permit", "wiring"],
    target: "property",
  },
  {
    id: "props-major-concrete",
    kind: "demo",
    ordinal: 4,
    label: "Properties with major concrete work",
    question: "Show all properties that underwent major concrete work.",
    keywords: ["concrete", "slab", "major concrete"],
    target: "property",
  },
  {
    id: "props-major-roof",
    kind: "demo",
    ordinal: 5,
    label: "Properties with major roof replacements",
    question: "Show all properties that underwent major roof replacements.",
    keywords: ["roof replacement", "major roof", "reroof"],
    target: "property",
  },
  {
    id: "props-major-electrical",
    kind: "demo",
    ordinal: 6,
    label: "Properties with major electrical upgrades",
    question: "Show all properties that underwent major electrical upgrades.",
    keywords: ["electrical upgrade", "service upgrade", "panel"],
    target: "property",
  },
  {
    id: "props-highest-permit-5y",
    kind: "demo",
    ordinal: 7,
    label: "Highest permit activity (5y)",
    question: "Show all properties with the highest permit activity during the last five years.",
    keywords: ["permit activity", "most permits", "five years", "5 years"],
    target: "property",
  },
  {
    id: "props-significant-reno",
    kind: "demo",
    ordinal: 8,
    label: "Significant renovation activity",
    question: "Show all properties with significant renovation activity.",
    keywords: ["renovation", "improvement", "significant"],
    target: "property",
  },
  {
    id: "contractors-roofing-lee",
    kind: "demo",
    ordinal: 9,
    label: "Roofing contractors in Lee County",
    question: "Show all contractors performing roofing work in Lee County.",
    keywords: ["roofing contractor", "roofers", "lee county roofing"],
    target: "contractor",
  },
  {
    id: "contractors-electrical-lee",
    kind: "demo",
    ordinal: 10,
    label: "Electrical contractors in Lee County",
    question: "Show all contractors performing electrical work in Lee County.",
    keywords: ["electrical contractor", "electricians", "lee county electrical"],
    target: "contractor",
  },
  {
    id: "contractors-negative-bbb",
    kind: "demo",
    ordinal: 11,
    label: "Contractors with negative BBB ratings",
    question: "Show contractors with negative BBB ratings.",
    keywords: ["negative bbb", "bad rating", "low rating", "bbb rating"],
    target: "contractor",
  },
  {
    id: "contractors-complaints",
    kind: "demo",
    ordinal: 12,
    label: "Contractors with complaint histories",
    question: "Show contractors with complaint histories.",
    keywords: ["complaints", "complaint history", "contractor complaints"],
    target: "contractor",
  },
  {
    id: "projects-bad-contractor",
    kind: "demo",
    ordinal: 13,
    label: "Projects by negative-BBB / complaint contractors",
    question:
      "Show projects completed by contractors with negative BBB ratings or complaint histories.",
    keywords: ["projects bad contractor", "complaint contractor projects", "negative bbb projects"],
    target: "project",
  },
  {
    id: "businesses-multi-property",
    kind: "demo",
    ordinal: 14,
    label: "Businesses across multiple properties",
    question: "Show businesses operating across multiple properties.",
    keywords: ["business multiple properties", "multi-location business", "business footprint"],
    target: "business",
  },
  {
    id: "owners-multi-property",
    kind: "demo",
    ordinal: 15,
    label: "Owners with multiple properties",
    question: "Show owners associated with multiple properties.",
    keywords: ["owner multiple properties", "portfolio owner", "multiple owners"],
    target: "owner",
  },
  {
    id: "tenants-multi-location",
    kind: "demo",
    ordinal: 16,
    label: "Tenants across multiple locations",
    question: "Show tenants operating across multiple locations.",
    keywords: ["tenant multiple locations", "multi-location tenant"],
    target: "tenant",
  },
  {
    id: "props-ownership-change-open-permit",
    kind: "demo",
    ordinal: 17,
    label: "Ownership change + active permits",
    question: "Show properties with both ownership changes and active permit activity.",
    keywords: ["ownership change permits", "sold and permits", "new owner permits"],
    target: "property",
  },
  {
    id: "props-permit-business-turnover",
    kind: "demo",
    ordinal: 18,
    label: "Active permits + business turnover",
    question: "Show properties with active permit activity and business turnover.",
    keywords: ["business turnover permits", "tenant turnover", "vacancy permits"],
    target: "property",
  },
  {
    id: "neighborhoods-increasing-permits",
    kind: "demo",
    ordinal: 19,
    label: "Neighborhoods with increasing permit activity",
    question: "Show neighborhoods with increasing permit activity.",
    keywords: ["neighborhood permits", "increasing permits", "permit trend"],
    target: "neighborhood",
  },
  {
    id: "neighborhoods-major-reno-concentration",
    kind: "demo",
    ordinal: 20,
    label: "Neighborhoods: highest major-reno concentration",
    question: "Show neighborhoods with the highest concentration of major renovations.",
    keywords: ["neighborhood renovations", "reno concentration", "major renovation neighborhood"],
    target: "neighborhood",
  },
  {
    id: "contractors-most-active",
    kind: "demo",
    ordinal: 21,
    label: "Most active contractors by project count",
    question: "Show the most active contractors by project count.",
    keywords: ["active contractors", "most projects", "contractor project count"],
    target: "contractor",
  },
  {
    id: "businesses-most-active-footprint",
    kind: "demo",
    ordinal: 22,
    label: "Most active businesses by property footprint",
    question: "Show the most active businesses by property footprint.",
    keywords: ["business footprint", "active businesses", "business properties"],
    target: "business",
  },
  {
    id: "entity-graph",
    kind: "demo",
    ordinal: 23,
    label: "Property ↔ contractor ↔ business ↔ tenant ↔ owner graph",
    question:
      "Show relationships between a selected property, contractor, business, tenant, and owner.",
    keywords: ["relationship graph", "entity graph", "connected entities"],
    target: "graph",
  },
  {
    id: "rag-nl-evidence",
    kind: "demo",
    ordinal: 24,
    label: "Natural-language question (RAG + evidence)",
    question: "Answer natural-language questions using the RAG layer and return supporting evidence.",
    keywords: ["natural language", "ask anything", "rag", "evidence"],
    target: "rag",
  },

  {
    id: "stretch-redevelopment",
    kind: "stretch",
    ordinal: 1,
    label: "Likely redevelopment",
    question: "Which properties appear likely to be undergoing redevelopment?",
    keywords: ["redevelopment", "redevelop", "teardown"],
    target: "property",
  },
  {
    id: "stretch-value-add",
    kind: "stretch",
    ordinal: 2,
    label: "Value-add investment activity",
    question: "Which properties show signs of value-add investment activity?",
    keywords: ["value-add", "investment activity", "value add"],
    target: "property",
  },
  {
    id: "stretch-complaint-linked-projects",
    kind: "stretch",
    ordinal: 3,
    label: "Contractors with most complaint-linked projects",
    question:
      "Which contractors are associated with the highest number of complaint-linked projects?",
    keywords: ["complaint-linked projects", "risky contractors"],
    target: "contractor",
  },
  {
    id: "stretch-owner-footprint",
    kind: "stretch",
    ordinal: 4,
    label: "Largest owner property footprint",
    question: "Which business owners control the largest property footprint?",
    keywords: ["largest footprint", "owner footprint", "biggest owner"],
    target: "owner",
  },
  {
    id: "stretch-permit-precedes-turnover",
    kind: "stretch",
    ordinal: 5,
    label: "Permit patterns preceding business turnover",
    question: "Which permit patterns typically precede business turnover?",
    keywords: ["permit pattern turnover", "precede turnover"],
    target: "property",
  },
  {
    id: "stretch-redevelopment-neighborhoods",
    kind: "stretch",
    ordinal: 6,
    label: "Strongest redevelopment-signal neighborhoods",
    question: "Which neighborhoods are showing the strongest redevelopment signals?",
    keywords: ["redevelopment neighborhood", "hot neighborhood"],
    target: "neighborhood",
  },
  {
    id: "stretch-acquisition-candidates",
    kind: "stretch",
    ordinal: 7,
    label: "Acquisition candidates",
    question:
      "Which properties are likely candidates for acquisition based on permit, ownership, and occupancy signals?",
    keywords: ["acquisition candidate", "acquire", "buy signal"],
    target: "property",
  },
  {
    id: "stretch-clean-major-reno-contractors",
    kind: "stretch",
    ordinal: 8,
    label: "Clean major-renovation contractors",
    question:
      "Which contractors consistently perform major renovations without negative BBB indicators?",
    keywords: ["clean contractor", "reliable contractor", "good major reno"],
    target: "contractor",
  },
  {
    id: "stretch-expanding-businesses",
    kind: "stretch",
    ordinal: 9,
    label: "Businesses expanding into multiple locations over time",
    question: "Which businesses have expanded into multiple locations over time?",
    keywords: ["expanding business", "multiple locations over time", "expansion"],
    target: "business",
  },
  {
    id: "stretch-anomalous-permits",
    kind: "stretch",
    ordinal: 10,
    label: "Anomalous permit activity vs nearby",
    question: "Which properties exhibit unusual permit activity compared to nearby properties?",
    keywords: ["anomaly", "unusual permits", "compared to nearby"],
    target: "property",
  },
];

export const DEMO_INQUIRIES = INQUIRIES.filter((i) => i.kind === "demo");
export const STRETCH_INQUIRIES = INQUIRIES.filter((i) => i.kind === "stretch");

export function getInquiry(id: string): InquiryDef | undefined {
  return INQUIRIES.find((i) => i.id === id);
}

export function routeInquiry(query: string): { inquiry: InquiryDef; score: number } | null {
  const q = query.toLowerCase();
  let best: { inquiry: InquiryDef; score: number } | null = null;
  for (const inquiry of INQUIRIES) {
    let score = 0;
    for (const kw of inquiry.keywords) {
      if (q.includes(kw)) score += kw.split(" ").length;
    }
    const qTokens = new Set(q.split(/\W+/).filter(Boolean));
    for (const t of inquiry.question.toLowerCase().split(/\W+/)) {
      if (t.length > 3 && qTokens.has(t)) score += 0.25;
    }
    if (!best || score > best.score) best = { inquiry, score };
  }
  return best && best.score > 0 ? best : null;
}
