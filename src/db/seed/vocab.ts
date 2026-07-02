export const COUNTY = { name: "Lee", stateCode: "FL", jurisdictionKey: "fl-lee" } as const;

export const MUNICIPALITIES = [
  { name: "Fort Myers", zips: ["33901", "33905", "33907", "33916"], priceMultiplier: 1.0 },
  { name: "Cape Coral", zips: ["33904", "33909", "33914", "33991"], priceMultiplier: 0.95 },
  { name: "Bonita Springs", zips: ["34134", "34135"], priceMultiplier: 1.2 },
  { name: "Estero", zips: ["33928", "33967"], priceMultiplier: 1.15 },
  { name: "Sanibel", zips: ["33957"], priceMultiplier: 1.8 },
  { name: "Fort Myers Beach", zips: ["33931"], priceMultiplier: 1.6 },
  { name: "Lehigh Acres", zips: ["33936", "33971", "33972", "33974"], priceMultiplier: 0.75 },
  { name: "North Fort Myers", zips: ["33903", "33917", "33918"], priceMultiplier: 0.85 },
] as const;

export const NEIGHBORHOODS = [
  "McGregor",
  "Whiskey Creek",
  "Gateway",
  "Pelican Preserve",
  "Cape Harbour",
  "Coral Oaks",
  "Spanish Wells",
  "Tanglewood",
  "Town and River",
  "Iona",
  "San Carlos Park",
  "Daniels Park",
] as const;

export const STREET_NAMES = [
  "McGregor",
  "Cleveland",
  "Colonial",
  "Del Prado",
  "Pine Island",
  "Summerlin",
  "Daniels",
  "Six Mile Cypress",
  "Veterans",
  "Hancock Bridge",
] as const;

export const STREET_SUFFIXES = ["Blvd", "Ave", "Pkwy", "St", "Ln", "Ct", "Dr"] as const;

export const DOR_USE_CODES = [
  { code: "0100", label: "Single Family", usageType: "residential", commercial: false },
  { code: "0400", label: "Condominium", usageType: "residential", commercial: false },
  { code: "0800", label: "Multi-Family <10", usageType: "residential", commercial: false },
  { code: "1100", label: "Stores, One Story", usageType: "commercial", commercial: true },
  { code: "1700", label: "Office Building", usageType: "commercial", commercial: true },
  { code: "2000", label: "Restaurant", usageType: "commercial", commercial: true },
  { code: "2700", label: "Auto Sales/Service", usageType: "commercial", commercial: true },
  { code: "4800", label: "Warehouse", usageType: "industrial", commercial: true },
] as const;

export const PERMIT_CATEGORIES = [
  { key: "roofing", prefix: "ROOF", valueLo: 8000, valueHi: 60000, feeLo: 150, feeHi: 900, commercialBias: 0.2, canBeMajor: true, descriptions: ["Re-roof shingle", "Tile roof replacement", "Roof repair"] },
  { key: "electrical", prefix: "ELEC", valueLo: 1500, valueHi: 80000, feeLo: 90, feeHi: 1200, commercialBias: 0.35, canBeMajor: true, descriptions: ["Service upgrade 200A", "Panel replacement", "Rewire", "EV charger"] },
  { key: "plumbing", prefix: "PLMB", valueLo: 1200, valueHi: 40000, feeLo: 80, feeHi: 700, commercialBias: 0.3, canBeMajor: true, descriptions: ["Repipe", "Sewer line", "Water heater"] },
  { key: "hvac", prefix: "MECH", valueLo: 4000, valueHi: 50000, feeLo: 120, feeHi: 800, commercialBias: 0.4, canBeMajor: true, descriptions: ["A/C changeout", "Ductwork", "Heat pump"] },
  { key: "concrete", prefix: "CONC", valueLo: 3000, valueHi: 120000, feeLo: 100, feeHi: 1500, commercialBias: 0.5, canBeMajor: true, descriptions: ["Driveway", "Slab pour", "Foundation footing"] },
  { key: "structural", prefix: "BLDG", valueLo: 20000, valueHi: 500000, feeLo: 400, feeHi: 6000, commercialBias: 0.45, canBeMajor: true, descriptions: ["Room addition", "Structural framing", "Demolition"] },
  { key: "pool", prefix: "POOL", valueLo: 25000, valueHi: 90000, feeLo: 300, feeHi: 1200, commercialBias: 0.1, canBeMajor: false, descriptions: ["Pool installation", "Pool resurface"] },
  { key: "solar", prefix: "SOLR", valueLo: 12000, valueHi: 45000, feeLo: 150, feeHi: 600, commercialBias: 0.2, canBeMajor: false, descriptions: ["Solar PV install", "Battery storage"] },
  { key: "fence", prefix: "FNCE", valueLo: 1500, valueHi: 12000, feeLo: 50, feeHi: 300, commercialBias: 0.25, canBeMajor: false, descriptions: ["Fence install", "Fence replacement"] },
  { key: "signage", prefix: "SIGN", valueLo: 800, valueHi: 25000, feeLo: 60, feeHi: 800, commercialBias: 0.9, canBeMajor: false, descriptions: ["Wall sign", "Monument sign"] },
  { key: "tenant_buildout", prefix: "COMM", valueLo: 30000, valueHi: 600000, feeLo: 500, feeHi: 9000, commercialBias: 0.95, canBeMajor: true, descriptions: ["Tenant build-out", "Interior remodel"] },
] as const;

export type PermitCategory = (typeof PERMIT_CATEGORIES)[number];

export const BBB_RATINGS = [
  "A+",
  "A",
  "A-",
  "B+",
  "B",
  "B-",
  "C+",
  "C",
  "C-",
  "D+",
  "D",
  "D-",
  "F",
  "NR",
] as const;

export const NEGATIVE_BBB_RATINGS = ["D+", "D", "D-", "F", "NR"] as const;

export const SUNBIZ_FILING_TYPES = [
  { code: "FLAL", label: "Florida Limited Liability Company" },
  { code: "DOMP", label: "Domestic Profit Corporation" },
  { code: "FORP", label: "Foreign Profit Corporation" },
  { code: "FLNP", label: "Florida Non Profit Corporation" },
  { code: "DOMLP", label: "Domestic Limited Partnership" },
] as const;

export const SUNBIZ_STATUS = ["ACTIVE", "INACTIVE", "INACT/UA", "DISSOLVED"] as const;

export const CONTRACTOR_TRADES = [
  "Roofing",
  "Electrical",
  "Plumbing",
  "HVAC",
  "Concrete",
  "General",
  "Pool",
  "Solar",
] as const;

export function strap(parts: {
  township: number;
  range: number;
  section: number;
  block: string;
  parcel: string;
}): { formatted: string; normalized: string } {
  const tt = String(parts.township).padStart(2, "0");
  const rr = String(parts.range).padStart(2, "0");
  const ss = String(parts.section).padStart(2, "0");
  const formatted = `${tt}-${rr}-${ss}-${parts.block}-${parcel4(parts.parcel)}.${parts.parcel.slice(-4).padStart(4, "0")}`;
  const normalized = formatted.replace(/[^0-9]/g, "");
  return { formatted, normalized };
}

function parcel4(p: string): string {
  return p.slice(0, 4).padStart(4, "0");
}

export const FIRST_NAMES = [
  "James", "Mary", "Robert", "Patricia", "John", "Jennifer", "Michael", "Linda",
  "David", "Elizabeth", "William", "Barbara", "Richard", "Susan", "Joseph",
  "Jessica", "Thomas", "Karen", "Carlos", "Maria", "Luis", "Ana", "Jorge",
  "Sofia", "Hassan", "Fatima", "Wei", "Mei", "Raj", "Priya",
] as const;

export const LAST_NAMES = [
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
  "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson",
  "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson",
  "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson",
] as const;

export const COMPANY_SUFFIXES = [
  "LLC", "Inc", "Corp", "Co", "Group", "Services", "Construction", "Contractors",
  "& Sons", "Enterprises",
] as const;

export const COMPANY_STEMS = [
  "Gulf Coast", "Sunshine", "Palm", "Coastal", "Tropic", "Cypress", "Estero",
  "Caloosa", "Pelican", "Mangrove", "Lighthouse", "Bluewater", "Everglade",
  "Banyan", "Royal", "Heritage", "Premier", "Apex", "Summit", "Anchor",
] as const;

export const BUSINESS_KINDS = [
  "Realty", "Holdings", "Properties", "Hospitality", "Cafe", "Bistro", "Auto",
  "Dental", "Medical", "Fitness", "Salon", "Boutique", "Logistics", "Marine",
  "Landscaping", "Insurance",
] as const;

export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizedAddressHash(parts: {
  streetNumber: string;
  streetName: string;
  city: string;
  postalCode: string;
}): string {
  const key = normalizeName(
    `${parts.streetNumber} ${parts.streetName} ${parts.city} ${parts.postalCode}`,
  ).replace(/ /g, "");
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export const TRADE_TO_CATEGORY_KEYS: Record<string, string[]> = {
  Roofing: ["roofing", "structural"],
  Electrical: ["electrical", "solar"],
  Plumbing: ["plumbing"],
  HVAC: ["hvac"],
  Concrete: ["concrete", "structural"],
  General: ["structural", "tenant_buildout", "concrete", "roofing"],
  Pool: ["pool", "concrete"],
  Solar: ["solar", "electrical"],
} as const;

export const CATEGORY_KEY_TO_TRADE: Record<string, string> = {
  roofing: "roofing",
  electrical: "electrical",
  plumbing: "plumbing",
  hvac: "hvac",
  concrete: "concrete",
  structural: "structural",
  tenant_buildout: "structural",
  solar: "electrical",
} as const;

export const REVIEW_POSITIVE = [
  "Excellent work, finished on time and on budget.",
  "Professional crew, highly recommend.",
  "Great communication throughout the project.",
  "Quality workmanship, would hire again.",
] as const;

export const REVIEW_NEGATIVE = [
  "Project ran weeks over schedule.",
  "Poor communication and unreturned calls.",
  "Workmanship had to be redone by another contractor.",
  "Charged more than the original estimate.",
] as const;

export const COMPLAINT_CATEGORIES = [
  "Billing/Collection Issues",
  "Problems with Product/Service",
  "Advertising/Sales Issues",
  "Guarantee/Warranty Issues",
  "Delivery Issues",
] as const;

export const COMPLAINT_STATUSES = ["Resolved", "Answered", "Unanswered", "Closed"] as const;
