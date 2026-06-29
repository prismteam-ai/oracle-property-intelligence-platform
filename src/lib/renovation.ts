export type RenovationTrade =
  | "roofing"
  | "electrical"
  | "concrete"
  | "structural"
  | "plumbing"
  | "hvac";

export const RENOVATION_TRADES: RenovationTrade[] = [
  "roofing",
  "electrical",
  "concrete",
  "structural",
  "plumbing",
  "hvac",
];

const TRADE_KEYWORDS: Record<RenovationTrade, string[]> = {
  roofing: ["roof", "reroof", "re-roof", "shingle", "truss", "roofing"],
  electrical: ["electric", "electrical", "wiring", "rewire", "panel", "service upgrade", "volt"],
  concrete: ["concrete", "slab", "foundation pour", "footing", "driveway", "paving"],
  structural: ["structural", "framing", "addition", "load-bearing", "demolition", "foundation"],
  plumbing: ["plumb", "plumbing", "repipe", "re-pipe", "sewer", "water line", "fixture"],
  hvac: ["hvac", "a/c", "air condition", "ac change", "mechanical", "heat pump", "ductwork", "furnace"],
};

export type PermitLike = {
  improvementType?: string | null;
  projectDescription?: string | null;
  description?: string | null;
  commRes?: string | null;
  volts?: string | null;
  estimatedJobValue?: string | number | null;
};

export const MAJOR_RENOVATION_VALUE_THRESHOLD = 50_000;

function haystack(permit: PermitLike): string {
  return [
    permit.improvementType,
    permit.projectDescription,
    permit.description,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

const CATEGORY_KEY_TO_TRADE: Record<string, RenovationTrade> = {
  roofing: "roofing",
  electrical: "electrical",
  plumbing: "plumbing",
  hvac: "hvac",
  concrete: "concrete",
  structural: "structural",
  tenant_buildout: "structural",
  solar: "electrical",
};

export function classifyTrades(permit: PermitLike): RenovationTrade[] {
  const text = haystack(permit);
  const trades = new Set<RenovationTrade>();
  const key = (permit.improvementType ?? "").toLowerCase();
  if (CATEGORY_KEY_TO_TRADE[key]) trades.add(CATEGORY_KEY_TO_TRADE[key]!);
  for (const trade of RENOVATION_TRADES) {
    if (TRADE_KEYWORDS[trade].some((kw) => text.includes(kw))) {
      trades.add(trade);
    }
  }
  if (permit.volts) trades.add("electrical");
  return [...trades];
}

export function permitMatchesTrade(permit: PermitLike, trade: RenovationTrade): boolean {
  return classifyTrades(permit).includes(trade);
}

export function isMajorRenovation(permit: PermitLike): boolean {
  const value =
    typeof permit.estimatedJobValue === "string"
      ? Number.parseFloat(permit.estimatedJobValue)
      : permit.estimatedJobValue ?? 0;
  if (Number.isFinite(value) && value >= MAJOR_RENOVATION_VALUE_THRESHOLD) return true;
  const text = haystack(permit);
  return /\b(major|addition|structural|new construction|substantial)\b/.test(text);
}

export function improvementScore(input: {
  permitCount5y: number;
  majorRenovationCount: number;
  totalPermitValue: number;
}): number {
  return (
    input.permitCount5y * 2 +
    input.majorRenovationCount * 10 +
    input.totalPermitValue / 100_000
  );
}

export type ImprovementBand = "high" | "medium" | "low";

export function improvementBand(score: number): ImprovementBand {
  if (score >= 40) return "high";
  if (score >= 15) return "medium";
  return "low";
}

export const SIGNIFICANT_RENOVATION_SCORE = 15;

export type ImprovementIndicators = {
  permitCount: number;
  openPermitCount: number;
  majorRenovationCount: number;
  totalPermitValue: number;
  trades: RenovationTrade[];
  score: number;
  band: ImprovementBand;
  isSignificant: boolean;
};

export function computeImprovementIndicators(
  permits: PermitLike[],
  openFlags: boolean[] = [],
): ImprovementIndicators {
  const trades = new Set<RenovationTrade>();
  let major = 0;
  let totalValue = 0;
  let open = 0;
  permits.forEach((p, i) => {
    for (const t of classifyTrades(p)) trades.add(t);
    if (isMajorRenovation(p)) major++;
    const value =
      typeof p.estimatedJobValue === "string"
        ? Number.parseFloat(p.estimatedJobValue)
        : p.estimatedJobValue ?? 0;
    if (Number.isFinite(value)) totalValue += value;
    if (openFlags[i]) open++;
  });
  const score = improvementScore({
    permitCount5y: permits.length,
    majorRenovationCount: major,
    totalPermitValue: totalValue,
  });
  return {
    permitCount: permits.length,
    openPermitCount: open,
    majorRenovationCount: major,
    totalPermitValue: totalValue,
    trades: [...trades],
    score,
    band: improvementBand(score),
    isSignificant: score >= SIGNIFICANT_RENOVATION_SCORE,
  };
}
