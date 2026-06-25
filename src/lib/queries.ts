/** Server-side data access for Oracle views (dashboard, lists, entity details). */
import { sql } from "@/db/client";

/* helper: AND-compose optional conditions */
function whereAnd(conds: any[]) {
  const f = conds.filter(Boolean);
  if (!f.length) return sql``;
  return sql`where ${f.reduce((acc, c, i) => (i === 0 ? c : sql`${acc} and ${c}`))}`;
}

/* ─────────────────────────── DASHBOARD ─────────────────────────── */
export async function getOverviewKpis() {
  const [r] = await sql`
    select
      (select count(*)::int from properties) as properties,
      (select count(*)::int from property_improvements) as permits,
      (select count(*)::int from property_improvements where is_open) as open_permits,
      (select count(*)::int from companies where is_contractor) as contractors,
      (select count(*)::int from companies where is_tenant) as businesses,
      (select count(*)::int from property_improvements where is_major_renovation) as major_renovations,
      (select coalesce(sum(market_value_amount),0)::bigint from properties) as total_value,
      (select count(*)::int from entity_documents) as documents,
      (select max(refreshed_at) from ingestion_runs) as last_refresh`;
  return r as any;
}
export async function getPermitActivityByMonth(months = 36) {
  return sql`
    select to_char(date_trunc('month', permit_issue_date), 'YYYY-MM') as ym,
           to_char(date_trunc('month', permit_issue_date), 'Mon ''YY') as label, count(*)::int as value
    from property_improvements
    where permit_issue_date >= (current_date - (${months} || ' months')::interval)
    group by 1, 2 order by 1`;
}
export async function getPermitsByType() {
  return sql`select improvement_type as label, count(*)::int as value from property_improvements group by 1 order by 2 desc`;
}
export async function getPermitsByCity() {
  return sql`
    select a.city_name as label, count(*)::int as value
    from property_improvements pi join addresses a on a.address_id = pi.address_id
    group by 1 order by 2 desc`;
}
export async function getDataSources() {
  return sql`select * from ingestion_runs order by refreshed_at desc`;
}

/* ─────────────────────────── PROPERTIES ─────────────────────────── */
export async function getPropertyFacets() {
  const [cities, usages] = await Promise.all([
    sql`select distinct city_name as v from addresses where city_name is not null order by 1`,
    sql`select distinct property_usage_type as v from properties where property_usage_type is not null order by 1`,
  ]);
  return { cities: cities.map((r: any) => r.v), usages: usages.map((r: any) => r.v) };
}
export async function listProperties(p: {
  city?: string; usage?: string; q?: string; sort?: string; openOnly?: boolean; limit?: number;
}) {
  const SORTS: Record<string, any> = {
    score: sql`p.improvement_score desc`, open: sql`p.open_permit_count desc`,
    value: sql`p.market_value_amount desc`, permits: sql`p.permit_count_5y desc`,
    recent: sql`p.created_at desc`,
  };
  const order = SORTS[p.sort ?? "score"] ?? SORTS.score;
  const where = whereAnd([
    p.city ? sql`a.city_name = ${p.city}` : null,
    p.usage ? sql`p.property_usage_type = ${p.usage}` : null,
    p.openOnly ? sql`p.open_permit_count > 0` : null,
    p.q ? sql`(a.unnormalized_address ilike ${"%" + p.q + "%"} or p.parcel_identifier ilike ${"%" + p.q + "%"})` : null,
  ]);
  return sql`
    select p.property_id, a.unnormalized_address as address, a.city_name as city, p.parcel_identifier as strap,
           p.property_type, p.property_usage_type as usage, p.property_structure_built_year as built,
           p.market_value_amount as value, p.open_permit_count as open_permits, p.open_permit_categories as open_cats,
           p.major_renovation_count as major_renos, p.permit_count_5y as permits_5y, p.improvement_score as score, p.neighborhood
    from properties p join addresses a on a.address_id = p.address_id
    ${where} order by ${order} limit ${p.limit ?? 60}`;
}

export async function getProperty(id: string) {
  const [r] = await sql`
    select p.*, a.unnormalized_address as address, a.city_name as city, a.postal_code as zip,
           a.latitude, a.longitude, par.parcel_identifier as strap, p.source_url as appraiser_url, p.source_record_key
    from properties p join addresses a on a.address_id = p.address_id
    left join parcels par on par.parcel_id = p.parcel_id
    where p.property_id = ${id}`;
  return r as any;
}
export async function getPropertyOwnership(id: string) {
  return sql`
    select o.ownership_id, o.owned_by, o.ownership_percentage, o.owner_occupied_indicator, o.date_acquired, o.date_sold, o.is_current,
           coalesce(pe.full_name, co.name) as owner_name, co.company_id as owner_company_id
    from ownerships o
    left join people pe on pe.person_id = o.owner_person_id
    left join companies co on co.company_id = o.owner_company_id
    where o.property_id = ${id} order by o.is_current desc, o.date_acquired desc`;
}
export async function getPropertySales(id: string) {
  return sql`
    select ownership_transfer_date as date, purchase_price_amount as price, sale_type, deed_book, deed_page, instrument_number, source_url
    from sales_histories where property_id = ${id} order by ownership_transfer_date desc`;
}
export async function getPropertyPermits(id: string) {
  return sql`
    select pi.property_improvement_id as id, pi.permit_number, pi.improvement_type as type, pi.improvement_status as status,
           pi.source_status, pi.is_open, pi.is_major_renovation, pi.comm_res, pi.application_received_date as applied,
           pi.permit_issue_date as issued, pi.permit_close_date as closed, pi.estimated_job_value as value, pi.fee,
           pi.project_description as description, pi.source_url, c.name as contractor, c.company_id as contractor_id
    from property_improvements pi left join companies c on c.company_id = pi.contractor_company_id
    where pi.property_id = ${id} order by pi.permit_issue_date desc`;
}
export async function getPropertyContractors(id: string) {
  return sql`
    select c.company_id, c.name, count(*)::int as projects, b.bbb_rating, round(b.rating_score) as score,
           b.complaint_count, max(pi.permit_issue_date) as last_project
    from property_improvements pi join companies c on c.company_id = pi.contractor_company_id
    left join business_reputation_profiles b on b.company_id = c.company_id
    where pi.property_id = ${id} group by c.company_id, c.name, b.bbb_rating, b.rating_score, b.complaint_count
    order by projects desc`;
}
export async function getPropertyOccupancies(id: string) {
  return sql`
    select o.occupancy_id, c.company_id, c.name as business, o.space_name, o.start_date, o.end_date, o.is_current,
           o.occupancy_type, br.filing_type, br.status as business_status
    from occupancies o join companies c on c.company_id = o.business_company_id
    left join business_registrations br on br.company_id = c.company_id
    where o.property_id = ${id} order by o.is_current desc, o.start_date desc`;
}

/* ─────────────────────────── CONTRACTORS ─────────────────────────── */
export async function getContractorFacets() {
  const cats = await sql`select distinct primary_category as v from business_reputation_profiles where primary_category is not null order by 1`;
  return { categories: cats.map((r: any) => r.v) };
}
export async function listContractors(p: { category?: string; rating?: string; q?: string; sort?: string; flagged?: boolean; limit?: number }) {
  const SORTS: Record<string, any> = {
    projects: sql`projects desc`, score: sql`score desc nulls last`, complaints: sql`complaints desc nulls last`, name: sql`name asc`,
  };
  const order = SORTS[p.sort ?? "projects"] ?? SORTS.projects;
  const where = whereAnd([
    sql`c.is_contractor`,
    p.category ? sql`b.primary_category = ${p.category}` : null,
    p.rating === "negative" ? sql`b.bbb_rating in ('C+','C','C-','D+','D','D-','F','NR')` : null,
    p.rating === "top" ? sql`b.bbb_rating in ('A+','A','A-')` : null,
    p.flagged ? sql`(b.complaint_count >= 3 or b.bbb_rating in ('C+','C','C-','D+','D','D-','F','NR'))` : null,
    p.q ? sql`c.name ilike ${"%" + p.q + "%"}` : null,
  ]);
  return sql`
    select c.company_id, c.name, b.primary_category as category, b.bbb_rating as rating, round(b.rating_score) as score,
           b.complaint_count as complaints, b.review_average_rating as reviews, b.is_accredited,
           q.score_band, (select count(*)::int from property_improvements pi where pi.contractor_company_id = c.company_id) as projects
    from companies c
    left join business_reputation_profiles b on b.company_id = c.company_id
    left join contractor_quality_scores q on q.company_id = c.company_id
    ${where} order by ${order} limit ${p.limit ?? 60}`;
}
export async function getContractor(id: string) {
  const [r] = await sql`
    select c.company_id, c.name,
           b.business_reputation_profile_id, b.profile_url, b.bbb_rating, round(b.rating_score) as rating_score,
           b.is_accredited, b.accreditation_status, b.accredited_since, b.review_average_rating, b.review_count,
           b.complaint_count, b.closed_complaints_past_three_years, b.unanswered_complaints,
           b.years_in_business, b.primary_category, b.source_url as bbb_url, b.retrieved_at,
           q.score as quality_score, q.score_band, q.factor_payload,
           (select count(*)::int from property_improvements pi where pi.contractor_company_id = c.company_id) as projects,
           (select count(*) filter (where is_major_renovation)::int from property_improvements pi where pi.contractor_company_id = c.company_id) as major_projects
    from companies c
    left join business_reputation_profiles b on b.company_id = c.company_id
    left join contractor_quality_scores q on q.company_id = c.company_id
    where c.company_id = ${id}`;
  return r as any;
}
export async function getContractorPermits(id: string) {
  return sql`
    select pi.permit_number, pi.improvement_type as type, pi.improvement_status as status, pi.is_open, pi.is_major_renovation,
           pi.permit_issue_date as issued, pi.estimated_job_value as value, a.unnormalized_address as address,
           a.city_name as city, pi.property_id
    from property_improvements pi left join addresses a on a.address_id = pi.address_id
    where pi.contractor_company_id = ${id} order by pi.permit_issue_date desc limit 200`;
}
export async function getContractorTypeBreakdown(id: string) {
  return sql`select improvement_type as label, count(*)::int as value from property_improvements where contractor_company_id = ${id} group by 1 order by 2 desc`;
}
export async function getContractorComplaints(id: string) {
  return sql`
    select co.complaint_date, co.complaint_closed_date, co.complaint_type, co.complaint_category, co.complaint_status, co.complaint_summary, co.source_url
    from business_reputation_complaints co join business_reputation_profiles b on b.business_reputation_profile_id = co.business_reputation_profile_id
    where b.company_id = ${id} order by co.complaint_date desc limit 50`;
}
export async function getContractorReviews(id: string) {
  return sql`
    select r.review_date, r.review_rating, r.review_title, r.review_text, r.reviewer_display_name
    from business_reputation_reviews r join business_reputation_profiles b on b.business_reputation_profile_id = r.business_reputation_profile_id
    where b.company_id = ${id} order by r.review_date desc limit 30`;
}

/* ─────────────────────────── BUSINESSES / TENANTS ─────────────────────────── */
export async function getBusinessFacets() {
  const [statuses] = [await sql`select distinct status as v from business_registrations where status is not null order by 1`];
  return { statuses: statuses.map((r: any) => r.v) };
}
export async function listBusinesses(p: { status?: string; q?: string; sort?: string; multiOnly?: boolean; limit?: number }) {
  const SORTS: Record<string, any> = { locations: sql`locations desc`, name: sql`name asc`, filed: sql`filed_date desc nulls last` };
  const order = SORTS[p.sort ?? "locations"] ?? SORTS.locations;
  const where = whereAnd([
    sql`c.is_tenant`,
    p.status ? sql`br.status = ${p.status}` : null,
    p.q ? sql`c.name ilike ${"%" + p.q + "%"}` : null,
    p.multiOnly ? sql`(select count(distinct property_id) from occupancies o where o.business_company_id = c.company_id) > 1` : null,
  ]);
  return sql`
    select c.company_id, c.name, br.filing_type, br.status, br.filed_date, br.document_number,
           (select count(distinct property_id)::int from occupancies o where o.business_company_id = c.company_id) as locations,
           (select count(distinct property_id)::int from occupancies o where o.business_company_id = c.company_id and o.is_current) as active
    from companies c left join business_registrations br on br.company_id = c.company_id
    ${where} order by ${order} limit ${p.limit ?? 60}`;
}
export async function getBusiness(id: string) {
  const [r] = await sql`
    select c.company_id, c.name, br.*, a.unnormalized_address as principal_address
    from companies c left join business_registrations br on br.company_id = c.company_id
    left join addresses a on a.address_id = br.principal_address_id
    where c.company_id = ${id}`;
  return r as any;
}
export async function getBusinessParties(id: string) {
  return sql`
    select pa.party_role, pa.name, pa.title
    from business_registration_parties pa join business_registrations br on br.business_registration_id = pa.business_registration_id
    where br.company_id = ${id} order by case when pa.party_role = 'Registered Agent' then 0 else 1 end, pa.name`;
}
export async function getBusinessLocations(id: string) {
  return sql`
    select o.occupancy_id, o.space_name, o.start_date, o.end_date, o.is_current, o.occupancy_type,
           p.property_id, a.unnormalized_address as address, a.city_name as city, p.property_usage_type as usage
    from occupancies o join properties p on p.property_id = o.property_id join addresses a on a.address_id = p.address_id
    where o.business_company_id = ${id} order by o.is_current desc, o.start_date desc`;
}
export async function getBusinessRelatedPermits(id: string) {
  return sql`
    select distinct pi.permit_number, pi.improvement_type as type, pi.improvement_status as status, pi.permit_issue_date as issued,
           a.unnormalized_address as address, pi.property_id
    from occupancies o join property_improvements pi on pi.property_id = o.property_id
    left join addresses a on a.address_id = pi.address_id
    where o.business_company_id = ${id} order by pi.permit_issue_date desc limit 60`;
}

export async function listTenants(p: { q?: string; sort?: string; multiOnly?: boolean; limit?: number }) {
  const SORTS: Record<string, any> = { locations: sql`locations desc`, name: sql`name asc` };
  const order = SORTS[p.sort ?? "locations"] ?? SORTS.locations;
  const where = whereAnd([
    sql`exists (select 1 from occupancies o where o.business_company_id = c.company_id)`,
    p.q ? sql`c.name ilike ${"%" + p.q + "%"}` : null,
    p.multiOnly ? sql`(select count(distinct property_id) from occupancies o where o.business_company_id = c.company_id) > 1` : null,
  ]);
  return sql`
    select c.company_id, c.name, br.filing_type, br.status,
           (select count(distinct property_id)::int from occupancies o where o.business_company_id = c.company_id) as locations,
           (select count(distinct property_id)::int from occupancies o where o.business_company_id = c.company_id and o.is_current) as active,
           (select min(start_date) from occupancies o where o.business_company_id = c.company_id) as since
    from companies c left join business_registrations br on br.company_id = c.company_id
    ${where} order by ${order} limit ${p.limit ?? 60}`;
}
