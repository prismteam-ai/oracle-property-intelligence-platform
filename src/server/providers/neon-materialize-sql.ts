import { sql, type SQL } from "drizzle-orm";

import { isSynthetic } from "@/lib/dataset";

function lineageObject(origin: string, synthetic: boolean): SQL {
  return sql`jsonb_build_object(
    'synthetic', ${synthetic}::boolean,
    'origin', ${origin}::text,
    'pipeline', ${synthetic ? "oracle-node@synthetic" : "oracle-node"}::text,
    'lexicon', '@elephant-xyz/query-db'
  )`;
}

export const TRADE_CASE = sql`
  case lower(pi.improvement_type)
    when 'roofing' then 'roofing'
    when 'electrical' then 'electrical'
    when 'plumbing' then 'plumbing'
    when 'hvac' then 'hvac'
    when 'concrete' then 'concrete'
    when 'structural' then 'structural'
    when 'tenant_buildout' then 'structural'
    when 'solar' then 'electrical'
    else null
  end
`;

export const IS_MAJOR = sql`(
  coalesce(pi.estimated_job_value, 0) >= 50000
  or coalesce(lower(pi.project_description), '') ~
     '\\m(major|addition|structural|new construction|substantial)\\M'
)`;

export function rollupMaterializationSelect(): SQL {
  return sql`
    with permit_rollup as (
      select
        pi.property_id,
        count(*)::int as permit_count_5y,
        count(*) filter (where pi.improvement_status = 'open')::int as open_permit_count,
        count(*) filter (where ${IS_MAJOR})::int as major_renovation_count,
        coalesce(sum(coalesce(pi.estimated_job_value, 0)), 0) as total_permit_value,
        array_remove(array_agg(distinct case when pi.improvement_status = 'open'
          then pi.improvement_type end), null) as open_permit_categories,
        array_remove(array_agg(distinct ${TRADE_CASE}), null) as renovation_trades
      from property_improvements pi
      where pi.property_id is not null
      group by pi.property_id
    ),
    sales_rollup as (
      select property_id, count(*)::int as ownership_change_count
      from sales_histories where property_id is not null group by property_id
    ),
    turnover_rollup as (
      select property_id, count(*)::int as business_turnover_count
      from occupancies
      where property_id is not null and occupancy_status = 'ended'
      group by property_id
    )
    select
      gen_random_uuid() as property_signal_rollup_id,
      p.property_id,
      p.parcel_id,
      p.parcel_identifier,
      addr.municipality_name,
      p.subdivision,
      coalesce(pr.open_permit_count, 0) as open_permit_count,
      coalesce(pr.open_permit_categories, array[]::text[]) as open_permit_categories,
      coalesce(pr.permit_count_5y, 0) as permit_count_5y,
      coalesce(pr.major_renovation_count, 0) as major_renovation_count,
      coalesce(pr.renovation_trades, array[]::text[]) as renovation_trades,
      round(
        coalesce(pr.permit_count_5y, 0) * 2
        + coalesce(pr.major_renovation_count, 0) * 10
        + coalesce(pr.total_permit_value, 0) / 100000.0
      , 2) as improvement_score,
      coalesce(sr.ownership_change_count, 0) as ownership_change_count,
      coalesce(tr.business_turnover_count, 0) as business_turnover_count,
      coalesce(pr.total_permit_value, 0) as total_permit_value,
      '{}'::jsonb as factor_payload,
      '{}'::jsonb as source_payload,
      'oracle:materialized' as source_system,
      'oracle:rollup:' || p.property_id::text as source_record_key,
      null::text as source_record_hash,
      null::text as source_artifact_uri,
      now() as loaded_at,
      now() as created_at,
      now() as updated_at
    from properties p
    left join addresses addr on addr.address_id = p.address_id
    left join permit_rollup pr on pr.property_id = p.property_id
    left join sales_rollup sr on sr.property_id = p.property_id
    left join turnover_rollup tr on tr.property_id = p.property_id
  `;
}

export function projectMaterializationSelect(): SQL {
  return sql`
    select
      gen_random_uuid() as project_id,
      pi.property_id,
      (array_agg(pi.parcel_id))[1] as parcel_id,
      null::text as request_identifier,
      coalesce(max(p.subdivision), 'Lee County') || ' improvement project' as project_name,
      'Aggregated improvements at ' || max(p.parcel_identifier) as project_description,
      case when bool_or(pi.improvement_status = 'open') then 'active' else 'completed' end
        as project_status,
      case when count(*) filter (where ${IS_MAJOR}) > 0 then 'renovation' else 'maintenance' end
        as project_type,
      case when count(*) filter (where ${IS_MAJOR}) > 0 then 1 else 0 end as is_major_renovation,
      array_remove(array_agg(distinct ${TRADE_CASE}), null) as renovation_trades,
      count(*)::int as permit_count,
      coalesce(sum(coalesce(pi.estimated_job_value, 0)), 0) as total_estimated_value,
      null::date as start_date,
      null::date as end_date,
      null::date as completion_date,
      '{}'::jsonb as source_payload,
      'oracle:materialized' as source_system,
      'oracle:project:' || pi.property_id::text as source_record_key,
      null::text as source_record_hash,
      null::text as source_artifact_uri,
      now() as loaded_at,
      now() as created_at,
      now() as updated_at
    from property_improvements pi
    left join properties p on p.property_id = pi.property_id
    where pi.property_id is not null
    group by pi.property_id
  `;
}

export function publicRecordsMaterializationSelect(
  synthetic: boolean = isSynthetic(),
): SQL {
  return sql`
    select
      gen_random_uuid() as public_record_id,
      ledger.entity_type,
      ledger.entity_id,
      ledger.source_url,
      ledger.collection_timestamp,
      ledger.refresh_timestamp,
      ledger.lineage,
      '{}'::jsonb as source_payload,
      ledger.source_system,
      ledger.source_record_key,
      ledger.source_record_hash,
      ledger.source_artifact_uri,
      now() as loaded_at,
      now() as created_at
    from (
      select 'property'::text as entity_type, p.property_id as entity_id,
             p.source_artifact_uri as source_url, p.loaded_at as collection_timestamp,
             p.updated_at as refresh_timestamp, p.source_system, p.source_record_key,
             p.source_record_hash, p.source_artifact_uri,
             ${lineageObject('leepa', synthetic)} as lineage
      from properties p
      union all
      select 'permit', pi.property_improvement_id, pi.source_url, pi.loaded_at, pi.updated_at,
             pi.source_system, pi.source_record_key, pi.source_record_hash, pi.source_artifact_uri,
             ${lineageObject('lee_accela', synthetic)}
      from property_improvements pi
      union all
      select 'business', br.business_registration_id, br.source_artifact_uri, br.loaded_at,
             br.updated_at, br.source_system, br.source_record_key, br.source_record_hash,
             br.source_artifact_uri, ${lineageObject('sunbiz', synthetic)}
      from business_registrations br
    ) ledger
  `;
}
