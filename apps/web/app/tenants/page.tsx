import type { Metadata } from "next";
import Link from "next/link";

import { listTenants, parseFilters } from "@oracle/query";
import { PageHeader } from "@/components/app/page-header";
import { FilterBar } from "@/components/app/filter-bar";
import { EmptyState } from "@/components/app/empty-state";
import { Pager } from "@/components/app/pager";
import { WorkspacePanel } from "@/components/app/workspace-panel";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { num, text } from "@/lib/format";

export const metadata: Metadata = { title: "Tenancy" };
export const dynamic = "force-dynamic";

export default async function TenantsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const filters = parseFilters(sp);
  const { rows, total } = await listTenants(filters);
  const pages = Math.max(1, Math.ceil(total / filters.pageSize));

  return (
    <div className="mx-auto max-w-[1440px] px-6 py-6">
      <PageHeader
        eyebrow="Occupancy signals"
        title="Tenancy"
        description={`${total.toLocaleString("en-US")} Sunbiz businesses inferred as occupants (occupancy is derived from a business registered at a property's address).`}
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="space-y-4">
          <FilterBar
            fields={[
              { name: "q", label: "Search (business name)" },
              { name: "municipality", label: "Municipality" },
            ]}
          />
          {rows.length === 0 ? (
            <EmptyState title="No tenancy records match" hint="Adjust the filters above." />
          ) : (
            <div className="overflow-x-auto rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Business</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Filing type</TableHead>
                    <TableHead className="text-right">Locations</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.business_registration_id}>
                      <TableCell>
                        <Link className="underline underline-offset-2" href={`/tenants/${r.business_registration_id}`}>
                          {text(r.entity_name)}
                        </Link>
                      </TableCell>
                      <TableCell>{text(r.status)}</TableCell>
                      <TableCell>{text(r.filing_type)}</TableCell>
                      <TableCell className="text-right">
                        <span className="nums">{num(r.occupancy_count)}</span>
                        {r.occupancy_count > 1 ? (
                          <Badge className="ml-2" variant="ink">multi-location</Badge>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <Pager page={filters.page} pages={pages} total={total} params={sp} />
        </section>

        <aside className="space-y-4">
          <WorkspacePanel title="How to use this view">
            <p className="text-sm leading-relaxed text-muted-foreground">
              This view reflects inferred occupancy, not residential tenancy. Use it to trace
              businesses operating at parcel addresses and identify multi-location operators.
            </p>
          </WorkspacePanel>
          <WorkspacePanel title="Signal summary">
            <p className="text-sm leading-relaxed text-muted-foreground">
              Multi-location businesses are surfaced in the list to support footprint, turnover,
              and cross-property occupancy demos.
            </p>
          </WorkspacePanel>
        </aside>
      </div>
    </div>
  );
}
