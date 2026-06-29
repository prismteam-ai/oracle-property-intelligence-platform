import Link from "next/link";

import type { NewPropertyImprovement } from "@/db/schema/types";
import { classifyTrades } from "@/lib/renovation";
import { Empty } from "@/components/ui";

const OPEN_STATUSES = ["open", "issued", "active", "in review"];

export function isOpenPermit(p: {
  improvementStatus?: string | null;
  sourceStatus?: string | null;
}): boolean {
  return OPEN_STATUSES.includes(
    (p.improvementStatus ?? p.sourceStatus ?? "").toLowerCase(),
  );
}

export function PermitTable({
  permits,
  testid,
  showContractor = false,
  contractorName,
}: {
  permits: NewPropertyImprovement[];
  testid?: string;
  showContractor?: boolean;
  contractorName?: (companyId: string | null | undefined) => string | null;
}) {
  if (!permits.length) return <Empty>None.</Empty>;
  return (
    <table data-testid={testid}>
      <thead>
        <tr>
          <th>Permit #</th>
          <th>Type</th>
          <th>Trades</th>
          <th>Status</th>
          <th>Issued</th>
          <th>Value</th>
          {showContractor ? <th>Contractor</th> : null}
          <th>Source</th>
        </tr>
      </thead>
      <tbody>
        {permits.map((p) => {
          const open = isOpenPermit(p);
          const trades = classifyTrades({
            improvementType: p.improvementType,
            projectDescription: p.projectDescription,
            description: p.description,
            volts: p.volts,
          });
          return (
            <tr key={p.propertyImprovementId ?? p.permitNumber} data-testid="permit-row">
              <td>{p.permitNumber}</td>
              <td>{p.improvementType}</td>
              <td>{trades.join(", ") || "—"}</td>
              <td>
                <span className={open ? "pill pill-open" : "pill"}>
                  {p.improvementStatus ?? p.sourceStatus ?? "?"}
                </span>
              </td>
              <td>{p.permitIssueDate ?? "—"}</td>
              <td>{p.estimatedJobValue ? `$${Number(p.estimatedJobValue).toLocaleString()}` : "—"}</td>
              {showContractor ? (
                <td>{contractorName?.(p.contractorCompanyId) ?? "—"}</td>
              ) : null}
              <td>
                {p.sourceUrl ? (
                  <a href={p.sourceUrl} target="_blank" rel="noreferrer">
                    {p.sourceSystem ?? "source"}
                  </a>
                ) : (
                  <span className="muted">{p.sourceSystem ?? "—"}</span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** Inline link to a property detail page. */
export function PropertyLink({
  propertyId,
  label,
}: {
  propertyId: string;
  label: string | null;
}) {
  return <Link href={`/properties/${propertyId}`}>{label ?? propertyId}</Link>;
}
