import type { Metadata } from "next";
import Link from "next/link";

import { listProperties, parseFilters } from "@oracle/query";
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

export const metadata: Metadata = { title: "Properties" };
export const dynamic = "force-dynamic";

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const filters = parseFilters(sp);
  const { rows, total } = await listProperties(filters);
  const pages = Math.max(1, Math.ceil(total / filters.pageSize));

  return (
    <div className="mx-auto max-w-[1440px] px-6 py-6">
      <PageHeader
        eyebrow="Property records"
        title="Properties"
        description={`${total.toLocaleString("en-US")} canonical Lee County parcels (covering 511,695 source appraiser records) with ownership, permits, occupancy, and improvement signals.`}
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="space-y-4">
          <FilterBar
            fields={[
              { name: "q", label: "Search (address, parcel)" },
              { name: "municipality", label: "Municipality" },
              { name: "propertyClass", label: "Property class" },
            ]}
          />
          {rows.length === 0 ? (
            <EmptyState title="No properties match" hint="Adjust the filters above." />
          ) : (
            <div className="overflow-x-auto rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Parcel</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead className="text-right">Built</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead className="text-right">Permits</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.property_id}>
                      <TableCell className="nums">
                        <Link className="underline underline-offset-2" href={`/properties/${r.property_id}`}>
                          {text(r.parcel_identifier)}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {text(r.address)}
                        {r.city ? `, ${text(r.city)}` : ""}
                      </TableCell>
                      <TableCell>{text(r.property_type)}</TableCell>
                      <TableCell className="nums text-right">{text(r.built_year)}</TableCell>
                      <TableCell>{text(r.owner)}</TableCell>
                      <TableCell className="text-right">
                        <span className="nums">{num(r.permit_count)}</span>
                        {r.open_permits > 0 ? (
                          <Badge className="ml-2" variant="risk">
                            {num(r.open_permits)} open
                          </Badge>
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
              Search by parcel, address, municipality, or property class, then pivot into the
              record dossier for permits, ownership, occupancy, and provenance.
            </p>
          </WorkspacePanel>
          <WorkspacePanel title="Signal summary">
            <p className="text-sm leading-relaxed text-muted-foreground">
              Open permits are surfaced inline so you can quickly isolate active work and jump into
              high-change parcels from the list.
            </p>
          </WorkspacePanel>
        </aside>
      </div>
    </div>
  );
}
