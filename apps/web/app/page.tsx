import Link from "next/link";

import { listContractors, listProperties } from "@oracle/query";
import { WORKSPACE_COPY } from "@oracle/shared/workbench-copy";
import { DomainLinkGrid } from "@/components/app/domain-link-grid";
import { QueryConsoleCard } from "@/components/app/query-console-card";
import { WorkspacePanel } from "@/components/app/workspace-panel";
import { WorkspaceStatStrip } from "@/components/app/workspace-stat-strip";
import { Badge } from "@/components/ui/badge";
import { num, text } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function HomePage(): Promise<React.ReactElement> {
  const [{ rows: properties }, { rows: contractors }] = await Promise.all([
    listProperties({ page: 1, pageSize: 5 }),
    listContractors({ page: 1, pageSize: 5 }),
  ]);

  return (
    <div className="mx-auto max-w-[1440px] space-y-6 px-6 py-6">
      <header className="space-y-3">
        <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Workspace
        </div>
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-normal">{WORKSPACE_COPY.title}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
              Investigate parcels, business occupancy, contractor activity, and source-backed
              inquiry results from one operational surface.
            </p>
          </div>
          <div className="rounded-md border border-border/70 bg-card/70 px-4 py-3 text-sm text-muted-foreground">
            Hosted demo mode with expanded sample corpus and grounded inquiry responses.
          </div>
        </div>
      </header>

      <WorkspaceStatStrip />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.95fr)]">
        <div className="space-y-6">
          <QueryConsoleCard />
          <WorkspacePanel title="Property watchlist">
            <div className="space-y-3">
              {properties.map((property) => (
                <Link
                  key={property.property_id}
                  href={`/properties/${property.property_id}`}
                  className="flex items-start justify-between gap-4 rounded-md border border-border/60 bg-background/40 px-4 py-3 transition-colors hover:border-primary/50 hover:bg-secondary/40"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground">
                      {text(property.address)}
                      {property.city ? `, ${text(property.city)}` : ""}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Parcel {text(property.parcel_identifier)} · {text(property.property_type)}
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      Owner {text(property.owner)}
                    </div>
                  </div>
                  <div className="shrink-0 text-right text-xs text-muted-foreground">
                    <div>{num(property.permit_count)} permits</div>
                    {property.open_permits > 0 ? (
                      <Badge className="mt-2" variant="risk">
                        {num(property.open_permits)} open
                      </Badge>
                    ) : null}
                  </div>
                </Link>
              ))}
            </div>
          </WorkspacePanel>
        </div>

        <div className="space-y-6">
          <WorkspacePanel title="Contractor risk">
            <div className="space-y-3">
              {contractors.map((contractor) => (
                <Link
                  key={contractor.business_reputation_profile_id}
                  href={`/contractors/${contractor.business_reputation_profile_id}`}
                  className="flex items-start justify-between gap-4 rounded-md border border-border/60 bg-background/40 px-4 py-3 transition-colors hover:border-primary/50 hover:bg-secondary/40"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground">{text(contractor.name)}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {text(contractor.score_band)} · {num(contractor.project_count)} linked projects
                    </div>
                  </div>
                  <div className="shrink-0 text-right text-xs text-muted-foreground">
                    {contractor.bbb_rating ? (
                      <Badge variant="score">{text(contractor.bbb_rating)}</Badge>
                    ) : (
                      "No rating"
                    )}
                    <div className="mt-2">{num(contractor.complaint_count ?? 0)} complaints</div>
                  </div>
                </Link>
              ))}
            </div>
          </WorkspacePanel>

          <WorkspacePanel title="Domain pivots">
            <DomainLinkGrid />
          </WorkspacePanel>
        </div>
      </div>
    </div>
  );
}
