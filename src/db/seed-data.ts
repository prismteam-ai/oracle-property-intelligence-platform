/**
 * Vocabularies + helpers for generating a realistic Lee County, FL dataset.
 *
 * Values (municipalities, ZIPs, STRAP parcel format, Accela/leepa/sunbiz/BBB URL
 * patterns, permit categories, BBB rating scale, Sunbiz filing types) are modeled
 * on the real public sources Oracle ingests. The records themselves are
 * representative synthetic data generated deterministically (seeded RNG) — they
 * stand in for the live Oracle → Neon query DB until that pipeline is connected.
 */

/* ───────────── deterministic RNG (mulberry32) ───────────── */
export function makeRng(seed: number) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export type Rng = () => number;

export const pick = <T>(rng: Rng, arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)];
export const randInt = (rng: Rng, lo: number, hi: number) => Math.floor(rng() * (hi - lo + 1)) + lo;
export const randFloat = (rng: Rng, lo: number, hi: number, dp = 2) => {
  const v = rng() * (hi - lo) + lo;
  const m = 10 ** dp;
  return Math.round(v * m) / m;
};
export const chance = (rng: Rng, p: number) => rng() < p;
export function weightedPick<T extends { weight: number }>(rng: Rng, arr: readonly T[]): T {
  const total = arr.reduce((s, x) => s + x.weight, 0);
  let r = rng() * total;
  for (const x of arr) {
    r -= x.weight;
    if (r <= 0) return x;
  }
  return arr[arr.length - 1];
}
export function shuffle<T>(rng: Rng, arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
/** YYYY-MM-DD between two ISO dates. */
export function dateBetween(rng: Rng, startISO: string, endISO: string): string {
  const s = new Date(startISO).getTime();
  const e = new Date(endISO).getTime();
  const t = s + rng() * (e - s);
  return new Date(t).toISOString().slice(0, 10);
}
export function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/* ───────────── Lee County geography ───────────── */
export interface Municipality {
  name: string;
  zips: string[];
  neighborhoods: string[];
}
export const MUNICIPALITIES: Municipality[] = [
  {
    name: "Cape Coral",
    zips: ["33904", "33909", "33914", "33990", "33991", "33993"],
    neighborhoods: ["Pelican", "Cape Harbour", "Sandoval", "Tarpon Point", "Coral Lakes", "Entrada", "Hancock", "Pine Island Rd Corridor"],
  },
  {
    name: "Fort Myers",
    zips: ["33901", "33907", "33908", "33912", "33916", "33919", "33966"],
    neighborhoods: ["Downtown River District", "McGregor", "Whiskey Creek", "Gateway", "Colonial", "Page Park", "Dunbar", "Iona"],
  },
  {
    name: "Lehigh Acres",
    zips: ["33936", "33971", "33972", "33973", "33974", "33976"],
    neighborhoods: ["Lehigh Estates", "Westminster", "Mirror Lakes", "Sunshine Blvd", "Joel Blvd", "Greenbriar"],
  },
  {
    name: "Bonita Springs",
    zips: ["34134", "34135"],
    neighborhoods: ["Bonita Beach", "Pelican Landing", "Spanish Wells", "Bonita Farms", "Imperial River"],
  },
  {
    name: "Estero",
    zips: ["33928", "33967", "34135"],
    neighborhoods: ["Miromar", "Coconut Point", "The Brooks", "Estero Bay", "Corkscrew"],
  },
  {
    name: "North Fort Myers",
    zips: ["33903", "33917", "33918"],
    neighborhoods: ["Moody River", "Del Prado North", "Hancock Bridge", "Bayshore"],
  },
  {
    name: "Fort Myers Beach",
    zips: ["33931"],
    neighborhoods: ["Estero Island", "Times Square", "Bowditch Point", "Santini"],
  },
  {
    name: "Sanibel",
    zips: ["33957"],
    neighborhoods: ["Periwinkle", "Gulf Pines", "East End", "Sanibel Bayous"],
  },
];

export const STREET_NAMES = [
  "Coral", "Palm", "Pelican", "McGregor", "Cypress", "Banyan", "Hibiscus", "Mariner", "Gulfstream",
  "Sabal", "Tarpon", "Manatee", "Heron", "Egret", "Sandpiper", "Lakeshore", "Veterans", "Cleveland",
  "Del Prado", "Santa Barbara", "Chiquita", "Skyline", "Andalusia", "Cape Coral", "Surfside", "Matlacha",
  "Estero", "Corkscrew", "Three Oaks", "Daniels", "Colonial", "Winkler", "Summerlin", "College", "Six Mile",
];
export const STREET_SUFFIXES = ["Blvd", "Pkwy", "Ave", "St", "Dr", "Ct", "Ln", "Ter", "Way", "Rd", "Cir"];
export const PRE_DIR = ["N", "S", "E", "W", "NE", "NW", "SE", "SW", ""];

/* ───────────── property usage ───────────── */
export const RESIDENTIAL_USAGE = [
  { type: "Single Family Residential", code: "0100", weight: 50 },
  { type: "Condominium", code: "0400", weight: 16 },
  { type: "Townhouse", code: "0110", weight: 6 },
  { type: "Multi-Family (2-9 units)", code: "0800", weight: 5 },
  { type: "Mobile Home", code: "0200", weight: 3 },
];
export const COMMERCIAL_USAGE = [
  { type: "Retail / Store", code: "1100", weight: 9 },
  { type: "Office Building", code: "1700", weight: 6 },
  { type: "Restaurant / Food Service", code: "2100", weight: 4 },
  { type: "Warehouse / Industrial", code: "4800", weight: 4 },
  { type: "Shopping Center / Plaza", code: "1600", weight: 3 },
  { type: "Medical / Professional", code: "1900", weight: 3 },
  { type: "Hotel / Motel", code: "3900", weight: 1 },
  { type: "Mixed Use", code: "1200", weight: 2 },
];
export const ZONING = ["RS-1", "RS-2", "RM-1", "RD", "C-1", "C-2", "CC", "I-1", "P-1", "AG-2", "PUD"];

/* ───────────── permits (Accela / Lee County) ───────────── */
export interface PermitType {
  type: string; // canonical improvement_type / category
  weight: number;
  prefix: string; // permit-number prefix
  canBeMajor: boolean;
  commercialBias: number; // 0..1 likelihood commercial
  feeLo: number;
  feeHi: number;
  valueLo: number;
  valueHi: number;
  descriptions: string[];
  bbbCategory: string; // contractor category that performs it
}
export const PERMIT_TYPES: PermitType[] = [
  {
    type: "Roofing", weight: 20, prefix: "ROOF", canBeMajor: true, commercialBias: 0.2,
    feeLo: 180, feeHi: 1200, valueLo: 9000, valueHi: 95000,
    descriptions: ["Reroof - tear off and replace shingle roof", "Replace flat roof membrane (TPO)", "Tile roof replacement", "Metal roof installation, hurricane upgrade", "Roof repair following storm damage"],
    bbbCategory: "Roofing Contractors",
  },
  {
    type: "Electrical", weight: 16, prefix: "ELE", canBeMajor: true, commercialBias: 0.3,
    feeLo: 90, feeHi: 900, valueLo: 1500, valueHi: 60000,
    descriptions: ["Electrical panel upgrade to 200A service", "Rewire residence", "Service change and meter relocation", "Install EV charger and subpanel", "Commercial tenant electrical buildout"],
    bbbCategory: "Electrical Contractors",
  },
  {
    type: "Plumbing", weight: 12, prefix: "PLM", canBeMajor: true, commercialBias: 0.3,
    feeLo: 90, feeHi: 700, valueLo: 1200, valueHi: 45000,
    descriptions: ["Repipe potable water lines", "Sewer line replacement", "Water heater replacement", "Backflow preventer installation", "Commercial grease interceptor"],
    bbbCategory: "Plumbing Contractors",
  },
  {
    type: "HVAC / Mechanical", weight: 13, prefix: "MEC", canBeMajor: true, commercialBias: 0.3,
    feeLo: 95, feeHi: 950, valueLo: 4500, valueHi: 70000,
    descriptions: ["A/C changeout - 4 ton system", "New ductwork and air handler", "Mini-split installation", "Rooftop package unit replacement", "Commercial HVAC system upgrade"],
    bbbCategory: "Heating and Air Conditioning",
  },
  {
    type: "Concrete", weight: 8, prefix: "CON", canBeMajor: true, commercialBias: 0.35,
    feeLo: 120, feeHi: 1500, valueLo: 6000, valueHi: 120000,
    descriptions: ["Driveway and apron replacement", "Concrete slab foundation pour", "Seawall cap and concrete repair", "Parking lot concrete reconstruction", "Structural concrete footers"],
    bbbCategory: "Concrete Contractors",
  },
  {
    type: "Structural / Building", weight: 9, prefix: "BLD", canBeMajor: true, commercialBias: 0.4,
    feeLo: 300, feeHi: 6000, valueLo: 25000, valueHi: 650000,
    descriptions: ["Room addition - 480 sf", "Structural repair and lintel replacement", "Second story addition", "Commercial interior buildout", "Garage conversion to living space", "Lanai enclosure and structural tie-in"],
    bbbCategory: "General Contractors",
  },
  {
    type: "Pool / Spa", weight: 6, prefix: "POOL", canBeMajor: false, commercialBias: 0.05,
    feeLo: 150, feeHi: 900, valueLo: 22000, valueHi: 95000,
    descriptions: ["In-ground pool and spa construction", "Pool resurfacing and equipment", "Screen enclosure for pool", "Pool deck and pavers"],
    bbbCategory: "Pool Contractors",
  },
  {
    type: "Solar / PV", weight: 5, prefix: "SOL", canBeMajor: false, commercialBias: 0.15,
    feeLo: 110, feeHi: 600, valueLo: 14000, valueHi: 55000,
    descriptions: ["Roof-mounted solar PV system 9.6kW", "Solar with battery backup", "Commercial rooftop solar array"],
    bbbCategory: "Solar Energy Contractors",
  },
  {
    type: "Windows / Doors", weight: 7, prefix: "WIN", canBeMajor: false, commercialBias: 0.15,
    feeLo: 90, feeHi: 700, valueLo: 6000, valueHi: 60000,
    descriptions: ["Impact window replacement - whole house", "Hurricane impact doors and sliders", "Storefront glazing replacement"],
    bbbCategory: "Window Installation",
  },
  {
    type: "Demolition", weight: 2, prefix: "DEM", canBeMajor: false, commercialBias: 0.4,
    feeLo: 150, feeHi: 2200, valueLo: 5000, valueHi: 90000,
    descriptions: ["Interior demolition for renovation", "Demolish detached structure", "Full commercial demolition"],
    bbbCategory: "Demolition Contractors",
  },
  {
    type: "Sign / Site", weight: 2, prefix: "SGN", canBeMajor: false, commercialBias: 0.9,
    feeLo: 90, feeHi: 800, valueLo: 2500, valueHi: 40000,
    descriptions: ["Illuminated wall sign", "Monument sign installation", "Site lighting and paving"],
    bbbCategory: "Sign Companies",
  },
];

/** Raw Accela status strings → normalized open/closed mapping. */
export const OPEN_STATUSES = ["Issued", "Active", "In Review", "Application Accepted", "Inspections", "Pending Inspections"];
export const CLOSED_STATUSES = ["Closed - Final", "Completed", "Finaled", "Certificate of Completion"];
export const TERMINAL_OTHER = ["Expired", "Withdrawn", "Cancelled", "Void"];

export const INSPECTION_TYPES = ["Footing", "Slab", "Framing", "Electrical Rough", "Electrical Final", "Plumbing Rough", "Mechanical Final", "Roofing In-Progress", "Roof Final", "Final Building", "Tie Beam", "Insulation"];
export const INSPECTION_RESULTS = [
  { type: "Approved", weight: 70 },
  { type: "Approved with Conditions", weight: 12 },
  { type: "Partial Approval", weight: 8 },
  { type: "Disapproved", weight: 7 },
  { type: "Cancelled", weight: 3 },
];
export const CONTACT_ROLES = ["Contractor", "Applicant", "Property Owner", "Licensed Professional", "Engineer"];

/* ───────────── contractors ───────────── */
export const CONTRACTOR_SPECIALTIES = [
  { category: "Roofing Contractors", types: ["Roofing"], license: "CCC" },
  { category: "Electrical Contractors", types: ["Electrical"], license: "EC" },
  { category: "Plumbing Contractors", types: ["Plumbing"], license: "CFC" },
  { category: "Heating and Air Conditioning", types: ["HVAC / Mechanical"], license: "CAC" },
  { category: "Concrete Contractors", types: ["Concrete"], license: "CGC" },
  { category: "General Contractors", types: ["Structural / Building", "Concrete", "Demolition"], license: "CGC" },
  { category: "Pool Contractors", types: ["Pool / Spa"], license: "CPC" },
  { category: "Solar Energy Contractors", types: ["Solar / PV"], license: "CVC" },
  { category: "Window Installation", types: ["Windows / Doors"], license: "CGC" },
];
export const CONTRACTOR_NAME_STEMS = [
  "Gulf Coast", "Sunshine State", "Cape", "Paradise", "Tropical", "Coastal", "Estero Bay", "Caloosa",
  "Southwest Florida", "Lee County", "Pelican", "Banyan", "Mangrove", "Heritage", "Premier", "Pro",
  "All-Star", "Reliable", "Apex", "Summit", "Blue Water", "Palm Tree", "First Coast", "Riverside",
  "Hurricane", "Tarpon", "Sabal", "Coral Reef", "Gateway", "Edison",
];
export const CONTRACTOR_NAME_TAILS = ["Roofing", "Electric", "Plumbing", "Air & Heat", "Construction", "Builders", "Concrete", "Pools", "Solar", "Contractors", "Home Services", "Exteriors", "Mechanical", "Services Group"];
export const COMPANY_SUFFIXES = ["LLC", "Inc", "Corp", "Co", "Group LLC", "Holdings LLC", "Enterprises Inc"];

/* ───────────── BBB ───────────── */
export const BBB_RATINGS = ["A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D", "D-", "F", "NR"];
export function ratingToScore(rating: string): number {
  const map: Record<string, [number, number]> = {
    "A+": [95, 100], A: [90, 95], "A-": [85, 90], "B+": [80, 85], B: [75, 80], "B-": [70, 75],
    "C+": [62, 70], C: [55, 62], "C-": [48, 55], "D+": [40, 48], D: [33, 40], "D-": [26, 33], F: [5, 26], NR: [0, 0],
  };
  return map[rating]?.[0] ?? 50;
}
export const COMPLAINT_TYPES = ["Service Issues", "Billing/Collection Issues", "Workmanship", "Contract Disputes", "Warranty Issues", "Delivery / Delay", "Misrepresentation"];
export const COMPLAINT_CATEGORIES = ["Problems with Product/Service", "Billing/Collection", "Advertising/Sales", "Guarantee/Warranty", "Delivery Issues"];
export const COMPLAINT_STATUSES = [
  { type: "Answered", weight: 55 },
  { type: "Resolved", weight: 25 },
  { type: "Unanswered", weight: 12 },
  { type: "Unresolved", weight: 8 },
];
export const COMPLAINT_SUMMARIES = [
  "Customer reports roof project not completed on the agreed timeline and rainwater intrusion.",
  "Consumer alleges deposit paid but work never started; requests refund.",
  "Homeowner states workmanship defects and contractor not returning calls.",
  "Dispute over change-order billing exceeding the signed estimate.",
  "Warranty claim for failed installation not honored by the business.",
  "Permit not pulled for work performed; customer cited by county.",
  "Project abandoned mid-renovation; customer seeking completion.",
];
export const REVIEW_TITLES_POS = ["Excellent work", "Highly recommend", "Professional and on time", "Great experience", "Quality job"];
export const REVIEW_TITLES_NEG = ["Disappointed", "Would not use again", "Poor communication", "Unfinished work", "Avoid this company"];
export const REVIEW_TEXT_POS = ["Crew was professional, cleaned up, and passed inspection on the first try.", "Fair price and finished ahead of schedule. Permitting was handled for us.", "Responsive from estimate to final inspection. Would hire again."];
export const REVIEW_TEXT_NEG = ["Took months longer than promised and stopped answering the phone.", "Had to hire another contractor to fix the work. Inspections failed twice.", "Billed well over the estimate with no explanation."];

/* ───────────── Sunbiz (businesses) ───────────── */
export const SUNBIZ_FILING_TYPES = [
  { type: "Florida Limited Liability Company", weight: 55, code: "L" },
  { type: "Florida Profit Corporation", weight: 25, code: "P" },
  { type: "Foreign Limited Liability Company", weight: 8, code: "M" },
  { type: "Florida Non Profit Corporation", weight: 5, code: "N" },
  { type: "Fictitious Name", weight: 7, code: "G" },
];
export const SUNBIZ_STATUSES = [
  { type: "Active", weight: 80 },
  { type: "Inactive", weight: 12 },
  { type: "Dissolved", weight: 6 },
  { type: "Admin Dissolution for Annual Report", weight: 2 },
];
export const SUNBIZ_PARTY_ROLES = ["Registered Agent", "Manager", "Managing Member", "President", "Vice President", "Secretary", "Director", "Authorized Person"];

export interface BusinessKind {
  label: string;
  weight: number;
  nameStems: string[];
  nameTails: string[];
  usageTypes: string[]; // commercial usage they tend to occupy
}
export const BUSINESS_KINDS: BusinessKind[] = [
  { label: "Restaurant", weight: 14, nameStems: ["Caloosa", "Gulf", "Pelican", "Banyan", "Riverside", "Island", "Tarpon"], nameTails: ["Grill", "Kitchen", "Cafe", "Bistro", "Tavern", "Raw Bar", "Pizza Co"], usageTypes: ["Restaurant / Food Service", "Mixed Use", "Shopping Center / Plaza"] },
  { label: "Retail", weight: 16, nameStems: ["Coastal", "Sandollar", "Palm", "Cape", "Sunshine", "Beachside"], nameTails: ["Boutique", "Outfitters", "Market", "Mercantile", "Trading Co", "Goods"], usageTypes: ["Retail / Store", "Shopping Center / Plaza", "Mixed Use"] },
  { label: "Professional Services", weight: 14, nameStems: ["Edison", "Gateway", "Summerlin", "Lee", "Heritage", "First Coast"], nameTails: ["Law Group", "CPA & Associates", "Title", "Insurance", "Realty", "Advisors"], usageTypes: ["Office Building", "Medical / Professional", "Mixed Use"] },
  { label: "Medical / Dental", weight: 10, nameStems: ["Coastal", "Gulf Coast", "Riverwalk", "Sanibel", "Caloosa"], nameTails: ["Dental", "Family Medicine", "Dermatology", "Physical Therapy", "Urgent Care", "Eye Care"], usageTypes: ["Medical / Professional", "Office Building"] },
  { label: "Personal Care", weight: 10, nameStems: ["Bliss", "Palm", "Coastal", "Lush", "Serene", "Bronze"], nameTails: ["Salon", "Spa", "Nails", "Barbershop", "Studio", "Wellness"], usageTypes: ["Retail / Store", "Shopping Center / Plaza"] },
  { label: "Fitness", weight: 6, nameStems: ["Iron", "Gulf", "Cape", "Coastal", "Edison"], nameTails: ["Fitness", "CrossFit", "Yoga", "Athletic Club", "Training"], usageTypes: ["Retail / Store", "Warehouse / Industrial", "Shopping Center / Plaza"] },
  { label: "Auto Services", weight: 7, nameStems: ["Gulf", "Cape", "Tarpon", "Pro", "Reliable"], nameTails: ["Auto", "Tire & Service", "Collision", "Detailing", "Motors"], usageTypes: ["Warehouse / Industrial", "Retail / Store"] },
  { label: "Hospitality / Lodging", weight: 4, nameStems: ["Sanibel", "Estero", "Beachfront", "Island", "Gulfview"], nameTails: ["Inn", "Suites", "Resort", "Cottages"], usageTypes: ["Hotel / Motel", "Mixed Use"] },
  { label: "Logistics / Trade", weight: 9, nameStems: ["Southwest Florida", "Gulf Coast", "Caloosa", "Gateway", "Lee County"], nameTails: ["Distribution", "Supply", "Logistics", "Wholesale", "Fabrication"], usageTypes: ["Warehouse / Industrial", "Office Building"] },
  { label: "Real Estate Holding", weight: 10, nameStems: ["Pelican Bay", "Cape Harbour", "McGregor", "Summerlin", "Estero Bay", "River District", "Three Oaks", "Gulfstream"], nameTails: ["Holdings", "Properties", "Investments", "Capital", "Partners", "Ventures"], usageTypes: ["Office Building", "Retail / Store", "Mixed Use", "Shopping Center / Plaza"] },
];

/* ───────────── people names ───────────── */
export const FIRST_NAMES = ["James", "Maria", "Robert", "Jennifer", "Michael", "Linda", "David", "Patricia", "John", "Carlos", "Ana", "William", "Elizabeth", "Richard", "Susan", "Joseph", "Karen", "Thomas", "Nancy", "Daniel", "Lisa", "Matthew", "Sandra", "Anthony", "Ashley", "Mark", "Kimberly", "Steven", "Donna", "Andrew", "Rosa", "Miguel", "Sofia", "Luis", "Diane", "Brian", "Angela", "Kevin", "Brenda", "Jason"];
export const LAST_NAMES = ["Smith", "Johnson", "Williams", "Garcia", "Martinez", "Rodriguez", "Brown", "Davis", "Miller", "Wilson", "Moore", "Taylor", "Anderson", "Thomas", "Hernandez", "Jackson", "White", "Lopez", "Lee", "Gonzalez", "Harris", "Clark", "Lewis", "Young", "Walker", "Hall", "Allen", "Nguyen", "Perez", "Roberts", "Turner", "Phillips", "Campbell", "Parker", "Evans", "Edwards", "Collins", "Reyes", "Stewart", "Morris"];

export const SALE_TYPES = ["Warranty Deed", "Quit Claim Deed", "Special Warranty Deed", "Certificate of Title", "Trustee Deed"];

/* ───────────── source provenance helpers ───────────── */
export const SOURCES = {
  appraisal: {
    system: "lee-county-property-appraiser",
    label: "Lee County Property Appraiser",
    base: "https://www.leepa.org",
    parcelUrl: (strap: string) => `https://www.leepa.org/Display/DisplayParcel.aspx?STRAP=${strap}`,
  },
  permits: {
    system: "lee-county-accela",
    label: "Lee County Community Development (Accela ACA)",
    base: "https://aca-prod.accela.com/LEECO",
    permitUrl: (num: string) => `https://aca-prod.accela.com/LEECO/Cap/CapDetail.aspx?Module=Permitting&capID=${encodeURIComponent(num)}`,
  },
  sunbiz: {
    system: "fl-sunbiz",
    label: "Florida Division of Corporations (Sunbiz)",
    base: "https://search.sunbiz.org",
    docUrl: (doc: string) => `https://search.sunbiz.org/Inquiry/CorporationSearch/ByDocumentNumber/${doc}`,
  },
  bbb: {
    system: "bbb",
    label: "Better Business Bureau",
    base: "https://www.bbb.org",
    profileUrl: (city: string, cat: string, slug: string, id: number) =>
      `https://www.bbb.org/us/fl/${city.toLowerCase().replace(/\s+/g, "-")}/profile/${cat.toLowerCase().replace(/[^a-z]+/g, "-")}/${slug}-90${id}`,
  },
  occupancy: {
    system: "oracle-derived-occupancy",
    label: "Oracle reconciliation (Sunbiz ↔ parcel address match)",
  },
} as const;

export const slugify = (s: string) =>
  s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

export const normalizeName = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();

/** Lee County STRAP: TT-RR-SS-BB-BBBB-PPPP (Lee county lead block, normalized = digits). */
export function makeStrap(rng: Rng): { display: string; normalized: string } {
  const a = randInt(rng, 1, 36).toString().padStart(2, "0");
  const b = randInt(rng, 20, 27).toString().padStart(2, "0");
  const c = randInt(rng, 1, 36).toString().padStart(2, "0");
  const d = randInt(rng, 0, 99).toString().padStart(2, "0");
  const e = randInt(rng, 0, 9999).toString().padStart(4, "0");
  const f = randInt(rng, 0, 9999).toString().padStart(4, "0");
  const display = `${a}-${b}-${c}-${d}-${e}.${f}`;
  return { display, normalized: `${a}${b}${c}${d}${e}${f}` };
}
