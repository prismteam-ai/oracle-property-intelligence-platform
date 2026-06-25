/**
 * Inquiry catalog — the analytical questions the platform can answer with
 * structured, source-backed queries. Each inquiry is a single source of truth
 * reused by (a) the Insights page and (b) the "Ask Oracle" NL router. Every
 * result carries the source systems it draws from for provenance/citation.
 */
import { sql } from "@/db/client";

export type Col = { key: string; label: string; type?: "text" | "num" | "money" | "date" | "badge" | "rating" };
export interface InquiryResult {
  columns: Col[];
  rows: Record<string, any>[];
  total: number;
  summary: string;
  sourceSystems: string[];
}
export interface Inquiry {
  id: string;
  label: string;
  question: string;
  group: string;
  keywords: string[];
  entity?: "property" | "contractor" | "business" | "tenant";
  stretch?: boolean;
  run: () => Promise<InquiryResult>;
}

const APPR = "lee-county-property-appraiser";
const PERMITS = "lee-county-accela";
const BBB = "bbb";
const SUNBIZ = "fl-sunbiz";
const OCC = "oracle-derived-occupancy";

const propHref = (id: string) => `/properties/${id}`;
const conHref = (id: string) => `/contractors/${id}`;
const bizHref = (id: string) => `/businesses/${id}`;

export const INQUIRIES: Inquiry[] = [
  /* ───────── permits / open ───────── */
  {
    id: "multi-open-permits", label: "Properties with more than one open permit", group: "Open permits",
    question: "Show all properties with more than one open permit", entity: "property",
    keywords: ["more than one open permit", "multiple open permits", "two open permits", "several open permits"],
    run: async () => {
      const rows = await sql`
        select p.property_id, a.unnormalized_address as address, a.city_name as municipality,
               p.property_usage_type as usage, p.open_permit_count as open_permits, p.open_permit_categories as categories
        from properties p join addresses a on a.address_id = p.address_id
        where p.open_permit_count > 1
        order by p.open_permit_count desc, p.open_permit_categories desc limit 150`;
      return {
        columns: [
          { key: "address", label: "Property" }, { key: "municipality", label: "City" },
          { key: "usage", label: "Use" }, { key: "open_permits", label: "Open", type: "num" },
          { key: "categories", label: "Categories", type: "num" },
        ],
        rows: rows.map((r: any) => ({ ...r, href: propHref(r.property_id) })),
        total: rows.length, summary: `${rows.length} properties currently have more than one open permit. These often indicate concurrent renovation or repair activity.`,
        sourceSystems: [APPR, PERMITS],
      };
    },
  },
  ...openCategoryInquiry("open-roofing", "Roofing", ["open roofing permit", "roofing permits open", "open roof permit"]),
  ...openCategoryInquiry("open-electrical", "Electrical", ["open electrical permit", "electrical permits open"]),
  ...openCategoryInquiry("open-plumbing", "Plumbing", ["open plumbing permit"]),
  /* ───────── major renovations ───────── */
  ...majorRenoInquiry("major-concrete", "Concrete", ["major concrete work", "concrete renovation", "concrete work"]),
  ...majorRenoInquiry("major-roof", "Roofing", ["major roof replacement", "roof replacement", "roof replacements", "reroof"]),
  ...majorRenoInquiry("major-electrical", "Electrical", ["major electrical upgrade", "electrical upgrade", "electrical upgrades", "panel upgrade"]),
  ...majorRenoInquiry("major-structural", "Structural / Building", ["structural work", "structural renovation", "addition"]),
  {
    id: "high-activity-5y", label: "Highest permit activity (last 5 years)", group: "Activity",
    question: "Show all properties with the highest permit activity during the last five years", entity: "property",
    keywords: ["highest permit activity", "most permits", "permit activity last five years", "most active properties"],
    run: async () => {
      const rows = await sql`
        select p.property_id, a.unnormalized_address as address, a.city_name as municipality,
               p.property_usage_type as usage, p.permit_count_5y as permits_5y, p.market_value_amount as value
        from properties p join addresses a on a.address_id = p.address_id
        order by p.permit_count_5y desc, p.improvement_score desc limit 100`;
      return {
        columns: [{ key: "address", label: "Property" }, { key: "municipality", label: "City" }, { key: "usage", label: "Use" }, { key: "permits_5y", label: "Permits (5y)", type: "num" }, { key: "value", label: "Market value", type: "money" }],
        rows: rows.map((r: any) => ({ ...r, href: propHref(r.property_id) })),
        total: rows.length, summary: `Top ${rows.length} properties ranked by permits issued in the last five years — a proxy for active investment and improvement.`,
        sourceSystems: [APPR, PERMITS],
      };
    },
  },
  {
    id: "significant-renovation", label: "Significant renovation activity", group: "Activity",
    question: "Show all properties with significant renovation activity", entity: "property",
    keywords: ["significant renovation", "renovation activity", "heavily renovated", "renovated properties"],
    run: async () => {
      const rows = await sql`
        select p.property_id, a.unnormalized_address as address, a.city_name as municipality,
               p.major_renovation_count as major_renos, p.improvement_score as score, p.market_value_amount as value
        from properties p join addresses a on a.address_id = p.address_id
        where p.major_renovation_count >= 2 order by p.improvement_score desc, p.major_renovation_count desc limit 100`;
      return {
        columns: [{ key: "address", label: "Property" }, { key: "municipality", label: "City" }, { key: "major_renos", label: "Major renos", type: "num" }, { key: "score", label: "Improvement score", type: "num" }, { key: "value", label: "Market value", type: "money" }],
        rows: rows.map((r: any) => ({ ...r, href: propHref(r.property_id) })),
        total: rows.length, summary: `${rows.length} properties show significant renovation activity (2+ major renovations), scored by the Oracle property improvement indicator.`,
        sourceSystems: [APPR, PERMITS],
      };
    },
  },
  /* ───────── contractors ───────── */
  ...tradeContractorInquiry("roofing-contractors", "Roofing", ["contractors performing roofing", "roofing contractors", "roofers"]),
  ...tradeContractorInquiry("electrical-contractors", "Electrical", ["contractors performing electrical", "electrical contractors", "electricians"]),
  {
    id: "negative-bbb", label: "Contractors with negative BBB ratings", group: "Contractor risk", entity: "contractor",
    question: "Show contractors with negative BBB ratings",
    keywords: ["negative bbb", "bad bbb rating", "low bbb", "poor bbb", "negative rating"],
    run: async () => {
      const rows = await sql`
        select c.company_id, b.name, b.bbb_rating as rating, round(b.rating_score) as score, b.complaint_count as complaints,
               b.review_average_rating as reviews, b.primary_category as trade
        from business_reputation_profiles b join companies c on c.company_id = b.company_id
        where b.bbb_rating in ('C+','C','C-','D+','D','D-','F','NR') and c.is_contractor
        order by b.rating_score asc nulls first, b.complaint_count desc limit 100`;
      return {
        columns: [{ key: "name", label: "Contractor" }, { key: "trade", label: "Trade" }, { key: "rating", label: "BBB", type: "rating" }, { key: "score", label: "Score", type: "num" }, { key: "complaints", label: "Complaints", type: "num" }, { key: "reviews", label: "Avg review", type: "num" }],
        rows: rows.map((r: any) => ({ ...r, href: conHref(r.company_id) })),
        total: rows.length, summary: `${rows.length} contractors carry a negative BBB rating (C or below, or Not Rated). Flagged for reputation risk before reuse.`,
        sourceSystems: [BBB, PERMITS],
      };
    },
  },
  {
    id: "contractor-complaints", label: "Contractors with complaint histories", group: "Contractor risk", entity: "contractor",
    question: "Show contractors with complaint histories",
    keywords: ["complaint history", "contractors with complaints", "complaints against contractors"],
    run: async () => {
      const rows = await sql`
        select c.company_id, b.name, b.primary_category as trade, b.bbb_rating as rating,
               b.complaint_count as complaints, b.closed_complaints_past_three_years as recent_complaints, b.unanswered_complaints as unanswered
        from business_reputation_profiles b join companies c on c.company_id = b.company_id
        where b.complaint_count >= 3 and c.is_contractor
        order by b.complaint_count desc limit 100`;
      return {
        columns: [{ key: "name", label: "Contractor" }, { key: "trade", label: "Trade" }, { key: "rating", label: "BBB", type: "rating" }, { key: "complaints", label: "Total", type: "num" }, { key: "recent_complaints", label: "Last 3y", type: "num" }, { key: "unanswered", label: "Unanswered", type: "num" }],
        rows: rows.map((r: any) => ({ ...r, href: conHref(r.company_id) })),
        total: rows.length, summary: `${rows.length} contractors have a complaint history (3+ BBB complaints). Includes unanswered-complaint counts.`,
        sourceSystems: [BBB],
      };
    },
  },
  {
    id: "projects-by-bad-contractors", label: "Projects by contractors with complaints/negative ratings", group: "Contractor risk", entity: "property",
    question: "Show projects completed by contractors with negative BBB ratings or complaint histories",
    keywords: ["projects completed by contractors with negative", "projects by bad contractors", "work by complaint contractors", "projects negative bbb"],
    run: async () => {
      const rows = await sql`
        select pi.property_improvement_id, pi.permit_number, pi.improvement_type as type, pi.improvement_status as status,
               c.company_id, c.name as contractor, b.bbb_rating as rating, b.complaint_count as complaints,
               a.unnormalized_address as address, pi.property_id
        from property_improvements pi
        join companies c on c.company_id = pi.contractor_company_id
        join business_reputation_profiles b on b.company_id = c.company_id
        left join addresses a on a.address_id = pi.address_id
        where (b.bbb_rating in ('C+','C','C-','D+','D','D-','F','NR') or b.complaint_count >= 5)
        order by b.complaint_count desc, pi.permit_issue_date desc limit 150`;
      return {
        columns: [{ key: "permit_number", label: "Permit" }, { key: "type", label: "Type" }, { key: "contractor", label: "Contractor" }, { key: "rating", label: "BBB", type: "rating" }, { key: "complaints", label: "Complaints", type: "num" }, { key: "address", label: "Property" }],
        rows: rows.map((r: any) => ({ ...r, href: propHref(r.property_id) })),
        total: rows.length, summary: `${rows.length} permitted projects were performed by contractors carrying a negative BBB rating or 5+ complaints — correlating contractor performance signals with completed work.`,
        sourceSystems: [PERMITS, BBB],
      };
    },
  },
  {
    id: "most-active-contractors", label: "Most active contractors by project count", group: "Contractor activity", entity: "contractor",
    question: "Show the most active contractors by project count",
    keywords: ["most active contractors", "contractors by project count", "busiest contractors", "top contractors"],
    run: async () => {
      const rows = await sql`
        select c.company_id, c.name, b.primary_category as trade, b.bbb_rating as rating, count(*)::int as projects,
               count(*) filter (where pi.is_major_renovation)::int as major
        from property_improvements pi join companies c on c.company_id = pi.contractor_company_id
        left join business_reputation_profiles b on b.company_id = c.company_id
        group by c.company_id, c.name, b.primary_category, b.bbb_rating
        order by projects desc limit 100`;
      return {
        columns: [{ key: "name", label: "Contractor" }, { key: "trade", label: "Trade" }, { key: "rating", label: "BBB", type: "rating" }, { key: "projects", label: "Projects", type: "num" }, { key: "major", label: "Major", type: "num" }],
        rows: rows.map((r: any) => ({ ...r, href: conHref(r.company_id) })),
        total: rows.length, summary: `Top ${rows.length} contractors ranked by total permitted projects across Lee County.`,
        sourceSystems: [PERMITS, BBB],
      };
    },
  },
  {
    id: "consistent-good-contractors", label: "Reliable contractors doing major work (no negative BBB)", group: "Contractor activity", entity: "contractor", stretch: true,
    question: "Which contractors consistently perform major renovations without negative BBB indicators?",
    keywords: ["consistently perform major renovations", "reliable contractors", "good contractors major work", "without negative bbb"],
    run: async () => {
      const rows = await sql`
        select c.company_id, c.name, b.primary_category as trade, b.bbb_rating as rating, round(b.rating_score) as score,
               count(*) filter (where pi.is_major_renovation)::int as major_projects, b.complaint_count as complaints
        from property_improvements pi join companies c on c.company_id = pi.contractor_company_id
        join business_reputation_profiles b on b.company_id = c.company_id
        where b.bbb_rating in ('A+','A','A-','B+') and coalesce(b.complaint_count,0) <= 2
        group by c.company_id, c.name, b.primary_category, b.bbb_rating, b.rating_score, b.complaint_count
        having count(*) filter (where pi.is_major_renovation) >= 2
        order by major_projects desc, b.rating_score desc limit 100`;
      return {
        columns: [{ key: "name", label: "Contractor" }, { key: "trade", label: "Trade" }, { key: "rating", label: "BBB", type: "rating" }, { key: "score", label: "Score", type: "num" }, { key: "major_projects", label: "Major projects", type: "num" }, { key: "complaints", label: "Complaints", type: "num" }],
        rows: rows.map((r: any) => ({ ...r, href: conHref(r.company_id) })),
        total: rows.length, summary: `${rows.length} contractors reliably deliver major renovations (2+) while maintaining a strong BBB rating and low complaints.`,
        sourceSystems: [PERMITS, BBB],
      };
    },
  },
  /* ───────── owners / businesses / tenants ───────── */
  {
    id: "multi-property-owners", label: "Owners associated with multiple properties", group: "Ownership", entity: "business",
    question: "Show owners associated with multiple properties",
    keywords: ["owners with multiple properties", "owners associated with multiple", "largest property footprint owner", "owners controlling"],
    run: async () => {
      const rows = await sql`
        select c.company_id, c.name, count(*)::int as properties, sum(p.market_value_amount)::bigint as portfolio_value,
               count(distinct a.city_name)::int as cities
        from ownerships o join companies c on c.company_id = o.owner_company_id
        join properties p on p.property_id = o.property_id join addresses a on a.address_id = p.address_id
        where o.is_current and o.owner_company_id is not null
        group by c.company_id, c.name having count(*) > 1
        order by properties desc limit 100`;
      return {
        columns: [{ key: "name", label: "Owner entity" }, { key: "properties", label: "Properties", type: "num" }, { key: "portfolio_value", label: "Portfolio value", type: "money" }, { key: "cities", label: "Cities", type: "num" }],
        rows: rows.map((r: any) => ({ ...r, href: bizHref(r.company_id), portfolio_value: Number(r.portfolio_value) })),
        total: rows.length, summary: `${rows.length} owner entities hold more than one property. Sorted by portfolio size — the top rows control the largest property footprints.`,
        sourceSystems: [APPR, SUNBIZ],
      };
    },
  },
  {
    id: "multi-property-businesses", label: "Businesses operating across multiple properties", group: "Businesses", entity: "business",
    question: "Show businesses operating across multiple properties",
    keywords: ["businesses operating across multiple properties", "businesses multiple locations", "most active businesses by footprint", "multi-location business"],
    run: async () => {
      const rows = await sql`
        select c.company_id, c.name, br.filing_type, count(distinct o.property_id)::int as locations,
               count(distinct o.property_id) filter (where o.is_current)::int as active
        from occupancies o join companies c on c.company_id = o.business_company_id
        left join business_registrations br on br.company_id = c.company_id
        group by c.company_id, c.name, br.filing_type having count(distinct o.property_id) > 1
        order by locations desc limit 100`;
      return {
        columns: [{ key: "name", label: "Business" }, { key: "filing_type", label: "Entity type" }, { key: "locations", label: "Locations", type: "num" }, { key: "active", label: "Active", type: "num" }],
        rows: rows.map((r: any) => ({ ...r, href: bizHref(r.company_id) })),
        total: rows.length, summary: `${rows.length} businesses operate across multiple properties — ranked by total location footprint.`,
        sourceSystems: [SUNBIZ, OCC],
      };
    },
  },
  {
    id: "multi-location-tenants", label: "Tenants operating across multiple locations", group: "Tenants", entity: "tenant",
    question: "Show tenants operating across multiple locations",
    keywords: ["tenants operating across multiple locations", "tenants multiple locations", "multi-location tenants", "expanded into multiple locations"],
    run: async () => {
      const rows = await sql`
        select c.company_id, c.name, count(distinct o.property_id)::int as locations,
               min(o.start_date) as since, count(distinct o.property_id) filter (where o.is_current)::int as active
        from occupancies o join companies c on c.company_id = o.business_company_id
        group by c.company_id, c.name having count(distinct o.property_id) > 1
        order by locations desc limit 100`;
      return {
        columns: [{ key: "name", label: "Tenant" }, { key: "locations", label: "Locations", type: "num" }, { key: "active", label: "Active now", type: "num" }, { key: "since", label: "First lease", type: "date" }],
        rows: rows.map((r: any) => ({ ...r, href: `/tenants/${r.company_id}` })),
        total: rows.length, summary: `${rows.length} tenants occupy more than one location across Lee County — a signal of expansion.`,
        sourceSystems: [OCC, SUNBIZ],
      };
    },
  },
  {
    id: "ownership-change-and-permits", label: "Ownership changes + active permits", group: "Investment signals", entity: "property",
    question: "Show properties with both ownership changes and active permit activity",
    keywords: ["ownership changes and active permit", "recently sold and permits", "ownership change permit activity", "bought and renovating"],
    run: async () => {
      const rows = await sql`
        select p.property_id, a.unnormalized_address as address, a.city_name as municipality,
               o.date_acquired as acquired, p.open_permit_count as open_permits, p.market_value_amount as value
        from properties p join addresses a on a.address_id = p.address_id
        join ownerships o on o.property_id = p.property_id and o.is_current
        where p.open_permit_count > 0 and o.date_acquired >= '2023-06-01'
        order by o.date_acquired desc, p.open_permit_count desc limit 120`;
      return {
        columns: [{ key: "address", label: "Property" }, { key: "municipality", label: "City" }, { key: "acquired", label: "Acquired", type: "date" }, { key: "open_permits", label: "Open permits", type: "num" }, { key: "value", label: "Value", type: "money" }],
        rows: rows.map((r: any) => ({ ...r, href: propHref(r.property_id) })),
        total: rows.length, summary: `${rows.length} properties changed hands since mid-2023 AND have active permits — a classic value-add / redevelopment signal.`,
        sourceSystems: [APPR, PERMITS],
      };
    },
  },
  {
    id: "permits-and-turnover", label: "Active permits + business turnover", group: "Investment signals", entity: "property",
    question: "Show properties with active permit activity and business turnover",
    keywords: ["active permit activity and business turnover", "permits business turnover", "turnover and permits"],
    run: async () => {
      const rows = await sql`
        with turn as (
          select property_id, count(*)::int as occupancy_records, count(*) filter (where not is_current)::int as past_tenants
          from occupancies group by property_id having count(*) >= 2)
        select p.property_id, a.unnormalized_address as address, a.city_name as municipality,
               p.open_permit_count as open_permits, t.past_tenants, t.occupancy_records
        from properties p join addresses a on a.address_id = p.address_id join turn t on t.property_id = p.property_id
        where p.open_permit_count > 0 order by t.past_tenants desc, p.open_permit_count desc limit 120`;
      return {
        columns: [{ key: "address", label: "Property" }, { key: "municipality", label: "City" }, { key: "open_permits", label: "Open permits", type: "num" }, { key: "past_tenants", label: "Past tenants", type: "num" }, { key: "occupancy_records", label: "Occupancies", type: "num" }],
        rows: rows.map((r: any) => ({ ...r, href: propHref(r.property_id) })),
        total: rows.length, summary: `${rows.length} commercial properties show active permits alongside tenant turnover — often precedes repositioning.`,
        sourceSystems: [PERMITS, OCC],
      };
    },
  },
  /* ───────── neighborhoods ───────── */
  {
    id: "neighborhood-trends", label: "Neighborhoods with increasing permit activity", group: "Neighborhoods",
    question: "Show neighborhoods with increasing permit activity",
    keywords: ["neighborhoods with increasing permit activity", "increasing permit activity", "neighborhood permit trend", "redevelopment signals neighborhoods"],
    run: async () => {
      const rows = await sql`
        with hood as (
          select p.neighborhood,
            count(*) filter (where pi.permit_issue_date >= '2024-06-15')::int as recent_12m,
            count(*) filter (where pi.permit_issue_date >= '2023-06-15' and pi.permit_issue_date < '2024-06-15')::int as prior_12m
          from property_improvements pi join properties p on p.property_id = pi.property_id
          group by p.neighborhood)
        select neighborhood, recent_12m, prior_12m,
          case when prior_12m = 0 then null else round((recent_12m - prior_12m)::numeric / prior_12m * 100) end as growth_pct
        from hood where recent_12m > prior_12m and prior_12m >= 5
        order by (recent_12m - prior_12m) desc limit 60`;
      return {
        columns: [{ key: "neighborhood", label: "Neighborhood" }, { key: "recent_12m", label: "Last 12m", type: "num" }, { key: "prior_12m", label: "Prior 12m", type: "num" }, { key: "growth_pct", label: "Growth %", type: "num" }],
        rows, total: rows.length, summary: `${rows.length} neighborhoods show year-over-year growth in permit activity — leading redevelopment indicators.`,
        sourceSystems: [PERMITS, APPR],
      };
    },
  },
  {
    id: "neighborhood-reno-concentration", label: "Neighborhoods with highest concentration of major renovations", group: "Neighborhoods",
    question: "Show neighborhoods with the highest concentration of major renovations",
    keywords: ["concentration of major renovations", "neighborhoods major renovations", "most renovations neighborhood"],
    run: async () => {
      const rows = await sql`
        select p.neighborhood, count(*) filter (where pi.is_major_renovation)::int as major_renos,
               count(distinct p.property_id)::int as properties,
               round(count(*) filter (where pi.is_major_renovation)::numeric / count(distinct p.property_id), 2) as per_property
        from property_improvements pi join properties p on p.property_id = pi.property_id
        group by p.neighborhood having count(distinct p.property_id) >= 10
        order by major_renos desc limit 60`;
      return {
        columns: [{ key: "neighborhood", label: "Neighborhood" }, { key: "major_renos", label: "Major renos", type: "num" }, { key: "properties", label: "Properties", type: "num" }, { key: "per_property", label: "Per property", type: "num" }],
        rows, total: rows.length, summary: `${rows.length} neighborhoods ranked by total major renovations — concentration highlights redevelopment hot spots.`,
        sourceSystems: [PERMITS],
      };
    },
  },
  /* ───────── stretch signals ───────── */
  {
    id: "redevelopment-candidates", label: "Likely redevelopment / acquisition candidates", group: "Investment signals", entity: "property", stretch: true,
    question: "Which properties are likely candidates for acquisition or redevelopment based on permit, ownership, and occupancy signals?",
    keywords: ["redevelopment", "acquisition candidates", "value-add investment", "likely undergoing redevelopment", "candidates for acquisition"],
    run: async () => {
      const rows = await sql`
        with turn as (select property_id, count(*) filter (where not is_current)::int as past_tenants from occupancies group by property_id)
        select p.property_id, a.unnormalized_address as address, a.city_name as municipality,
               p.improvement_score as score, p.open_permit_count as open_permits, p.major_renovation_count as major,
               (o.date_acquired >= '2022-01-01') as recently_sold, coalesce(t.past_tenants,0) as turnover,
               (p.improvement_score + p.open_permit_count*8 + coalesce(t.past_tenants,0)*6 + (case when o.date_acquired >= '2022-01-01' then 20 else 0 end))::int as signal_score
        from properties p join addresses a on a.address_id = p.address_id
        join ownerships o on o.property_id = p.property_id and o.is_current
        left join turn t on t.property_id = p.property_id
        where p.open_permit_count > 0 or p.major_renovation_count > 0
        order by signal_score desc limit 80`;
      return {
        columns: [{ key: "address", label: "Property" }, { key: "municipality", label: "City" }, { key: "signal_score", label: "Signal", type: "num" }, { key: "open_permits", label: "Open", type: "num" }, { key: "major", label: "Major renos", type: "num" }, { key: "turnover", label: "Turnover", type: "num" }],
        rows: rows.map((r: any) => ({ ...r, href: propHref(r.property_id) })),
        total: rows.length, summary: `Composite signal blending improvement score, open permits, tenant turnover, and recent sale. Top ${rows.length} candidates for value-add / acquisition.`,
        sourceSystems: [APPR, PERMITS, OCC],
      };
    },
  },
];

/* ───────── parameterized inquiry factories ───────── */
function openCategoryInquiry(id: string, category: string, keywords: string[]): Inquiry[] {
  return [{
    id, label: `Open ${category.toLowerCase()} permits`, group: "Open permits", entity: "property",
    question: `Show all properties with open ${category.toLowerCase()} permits`, keywords,
    run: async () => {
      const rows = await sql`
        select distinct p.property_id, a.unnormalized_address as address, a.city_name as municipality,
               p.property_usage_type as usage, count(pi.*)::int as open_of_type
        from property_improvements pi join properties p on p.property_id = pi.property_id
        join addresses a on a.address_id = p.address_id
        where pi.is_open and pi.improvement_type = ${category}
        group by p.property_id, a.unnormalized_address, a.city_name, p.property_usage_type
        order by open_of_type desc limit 150`;
      return {
        columns: [{ key: "address", label: "Property" }, { key: "municipality", label: "City" }, { key: "usage", label: "Use" }, { key: "open_of_type", label: `Open ${category}`, type: "num" }],
        rows: rows.map((r: any) => ({ ...r, href: propHref(r.property_id) })),
        total: rows.length, summary: `${rows.length} properties have at least one open ${category} permit.`,
        sourceSystems: [PERMITS, APPR],
      };
    },
  }];
}
function majorRenoInquiry(id: string, category: string, keywords: string[]): Inquiry[] {
  const nice = category.replace(" / Building", "");
  return [{
    id, label: `Major ${nice.toLowerCase()} renovations`, group: "Major renovations", entity: "property",
    question: `Show all properties that underwent major ${nice.toLowerCase()} work`, keywords,
    run: async () => {
      const rows = await sql`
        select distinct p.property_id, a.unnormalized_address as address, a.city_name as municipality,
               max(pi.completion_date) as completed, max(pi.estimated_job_value)::int as top_value
        from property_improvements pi join properties p on p.property_id = pi.property_id
        join addresses a on a.address_id = p.address_id
        where pi.is_major_renovation and pi.improvement_type = ${category}
        group by p.property_id, a.unnormalized_address, a.city_name
        order by top_value desc limit 150`;
      return {
        columns: [{ key: "address", label: "Property" }, { key: "municipality", label: "City" }, { key: "completed", label: "Completed", type: "date" }, { key: "top_value", label: "Job value", type: "money" }],
        rows: rows.map((r: any) => ({ ...r, href: propHref(r.property_id) })),
        total: rows.length, summary: `${rows.length} properties underwent major ${nice.toLowerCase()} work (high-value ${category} permits).`,
        sourceSystems: [PERMITS, APPR],
      };
    },
  }];
}
function tradeContractorInquiry(id: string, category: string, keywords: string[]): Inquiry[] {
  return [{
    id, label: `Contractors performing ${category.toLowerCase()} work`, group: "Contractor activity", entity: "contractor",
    question: `Show all contractors performing ${category.toLowerCase()} work in Lee County`, keywords,
    run: async () => {
      const rows = await sql`
        select c.company_id, c.name, b.bbb_rating as rating, round(b.rating_score) as score, b.complaint_count as complaints,
               count(*)::int as ${sql.unsafe(category.toLowerCase().replace(/[^a-z]/g, "_"))}_jobs
        from property_improvements pi join companies c on c.company_id = pi.contractor_company_id
        left join business_reputation_profiles b on b.company_id = c.company_id
        where pi.improvement_type = ${category}
        group by c.company_id, c.name, b.bbb_rating, b.rating_score, b.complaint_count
        order by 6 desc limit 100`;
      const jobKey = `${category.toLowerCase().replace(/[^a-z]/g, "_")}_jobs`;
      return {
        columns: [{ key: "name", label: "Contractor" }, { key: "rating", label: "BBB", type: "rating" }, { key: "score", label: "Score", type: "num" }, { key: "complaints", label: "Complaints", type: "num" }, { key: jobKey, label: `${category} jobs`, type: "num" }],
        rows: rows.map((r: any) => ({ ...r, href: conHref(r.company_id) })),
        total: rows.length, summary: `${rows.length} contractors have pulled ${category} permits in Lee County, with their BBB reputation alongside.`,
        sourceSystems: [PERMITS, BBB],
      };
    },
  }];
}

export const inquiryById = (id: string) => INQUIRIES.find((i) => i.id === id);
