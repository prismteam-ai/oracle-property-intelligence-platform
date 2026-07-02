import "server-only";

import { and, desc, eq, ilike, inArray, sql } from "drizzle-orm";

import { db } from "@/server/pg";
import {
  addresses,
  businessRegistrations,
  companies,
  occupancies,
  ownerships,
  parcels,
  people,
  properties,
  propertyImprovements,
  salesHistories,
} from "@/db/schema";
import type { Property, SalesHistory } from "@/db/schema/types";
import type { OwnershipRecord, PropertyFilters } from "@/server/ports";
import { rowDisplayLimit } from "@/lib/dataset";

const DEFAULT_LIMIT = rowDisplayLimit();

export async function listProperties(filters: PropertyFilters = {}): Promise<Property[]> {
  const conds = [];
  if (filters.county) {
    conds.push(
      sql`${properties.addressId} IN (SELECT ${addresses.addressId} FROM ${addresses} WHERE ${
        addresses.countyName
      } ILIKE ${`%${filters.county}%`})`,
    );
  }
  if (filters.municipality) {
    conds.push(
      sql`(${properties.subdivision} ILIKE ${`%${filters.municipality}%`} OR ${
        properties.addressId
      } IN (SELECT ${addresses.addressId} FROM ${addresses} WHERE ${
        addresses.municipalityName
      } ILIKE ${`%${filters.municipality}%`}))`,
    );
  }
  if (filters.propertyClass) {
    conds.push(ilike(properties.propertyUsageType, `%${filters.propertyClass}%`));
  }
  if (filters.permitType) {
    conds.push(
      sql`exists (select 1 from ${propertyImprovements} pi
        where pi.property_id = ${properties.propertyId}
          and lower(pi.improvement_type) = ${filters.permitType.toLowerCase()})`,
    );
  }
  if (filters.contractor) {
    conds.push(
      sql`exists (select 1 from ${propertyImprovements} pi
        join ${companies} co on co.company_id = pi.contractor_company_id
        where pi.property_id = ${properties.propertyId}
          and co.name ilike ${`%${filters.contractor}%`})`,
    );
  }
  if (filters.dateFrom) {
    conds.push(
      sql`exists (select 1 from ${propertyImprovements} pi
        where pi.property_id = ${properties.propertyId}
          and pi.permit_issue_date >= ${filters.dateFrom})`,
    );
  }
  if (filters.dateTo) {
    conds.push(
      sql`exists (select 1 from ${propertyImprovements} pi
        where pi.property_id = ${properties.propertyId}
          and pi.permit_issue_date <= ${filters.dateTo})`,
    );
  }
  if (filters.businessType) {
    conds.push(
      sql`exists (select 1 from ${occupancies} oc
        join ${businessRegistrations} br on br.business_registration_id = oc.business_registration_id
        where oc.property_id = ${properties.propertyId}
          and br.filing_type ilike ${`%${filters.businessType}%`})`,
    );
  }
  const where = conds.length ? and(...conds) : undefined;
  return db
    .select()
    .from(properties)
    .where(where)
    .orderBy(desc(properties.updatedAt))
    .limit(filters.limit ?? DEFAULT_LIMIT)
    .offset(filters.offset ?? 0);
}

export async function listOwnershipHistory(
  propertyId: string,
): Promise<OwnershipRecord[]> {
  const rows = await db
    .select({
      ownership: ownerships,
      companyName: companies.name,
      personName: people.fullName,
    })
    .from(ownerships)
    .leftJoin(companies, eq(companies.companyId, ownerships.ownerCompanyId))
    .leftJoin(people, eq(people.personId, ownerships.ownerPersonId))
    .where(eq(ownerships.propertyId, propertyId))
    .orderBy(desc(ownerships.dateAcquired));
  return rows.map((r) => ({
    ...r.ownership,
    ownerName: r.companyName ?? r.personName ?? null,
    ownerKind: r.ownership.ownerCompanyId
      ? "company"
      : r.ownership.ownerPersonId
        ? "person"
        : "unknown",
  }));
}

export async function listSalesHistory(propertyId: string): Promise<SalesHistory[]> {
  return db
    .select()
    .from(salesHistories)
    .where(eq(salesHistories.propertyId, propertyId))
    .orderBy(desc(salesHistories.ownershipTransferDate));
}

export { inArray };

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export async function getPropertyByParcelIdentifier(
  parcelIdentifier: string,
): Promise<Property | null> {
  const rows = await db
    .select()
    .from(properties)
    .where(eq(properties.parcelIdentifier, parcelIdentifier))
    .limit(1);
  return rows[0] ?? null;
}

export async function getPropertyById(propertyId: string): Promise<Property | null> {
  if (!isUuid(propertyId)) {
    return getPropertyByParcelIdentifier(propertyId);
  }
  const rows = await db
    .select()
    .from(properties)
    .where(eq(properties.propertyId, propertyId))
    .limit(1);
  return rows[0] ?? null;
}

export type OwnerFootprintRow = {
  ownerCompanyId: string | null;
  ownerPersonId: string | null;
  ownerName: string | null;
  propertyCount: number;
  representativePropertyId: string | null;
  sourceArtifactUri: string | null;
  sourceRecordKey: string | null;
  sourceSystem: string | null;
};

export async function ownersWithMultipleProperties(
  limit = DEFAULT_LIMIT,
): Promise<OwnerFootprintRow[]> {
  const rows = await db.execute<{
    owner_company_id: string | null;
    owner_person_id: string | null;
    owner_name: string | null;
    property_count: number;
    representative_property_id: string | null;
    source_artifact_uri: string | null;
    source_record_key: string | null;
    source_system: string | null;
  }>(sql`
    with grouped as (
      select
        upper(btrim(owned_by)) as owner_key,
        max(owner_company_id::text) as owner_company_id,
        max(owner_person_id::text) as owner_person_id,
        count(distinct property_id)::int as property_count,
        (array_agg(property_id order by property_id))[1] as representative_property_id
      from ownerships
      where owned_by is not null
        and btrim(owned_by) <> ''
        and upper(btrim(owned_by)) not in ('UNKNOWN', 'UNKNOWN HEIRS OF')
      group by upper(btrim(owned_by))
      having count(distinct property_id) > 1
    )
    select
      g.owner_company_id, g.owner_person_id,
      coalesce(co.name, pe.full_name, initcap(g.owner_key)) as owner_name,
      g.property_count,
      g.representative_property_id,
      p.source_artifact_uri, p.source_record_key, p.source_system
    from grouped g
    left join companies co on co.company_id = g.owner_company_id::uuid
    left join people pe on pe.person_id = g.owner_person_id::uuid
    left join properties p on p.property_id = g.representative_property_id
    order by g.property_count desc
    limit ${limit}
  `);
  return rows.rows.map((r) => ({
    ownerCompanyId: r.owner_company_id,
    ownerPersonId: r.owner_person_id,
    ownerName: r.owner_name,
    propertyCount: Number(r.property_count ?? 0),
    representativePropertyId: r.representative_property_id,
    sourceArtifactUri: r.source_artifact_uri,
    sourceRecordKey: r.source_record_key,
    sourceSystem: r.source_system,
  }));
}

export { parcels };
