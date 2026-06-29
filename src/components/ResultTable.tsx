import Link from "next/link";

import type { InquiryResultRow } from "@/server/ports";

export function ResultTable({
  columns,
  rows,
  emptyNote,
}: {
  columns: string[];
  rows: InquiryResultRow[];
  emptyNote?: string;
}) {
  if (!rows.length) {
    return <p className="muted">{emptyNote ?? "No results."}</p>;
  }
  const cols = columns.filter((c) => c !== "href" && c !== "citations");
  return (
    <table>
      <thead>
        <tr>
          {cols.map((c) => (
            <th key={c}>{c}</th>
          ))}
          <th>link</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            {cols.map((c) => (
              <td key={c}>{formatCell(row[c])}</td>
            ))}
            <td>
              {typeof row.href === "string" ? <Link href={row.href}>open</Link> : null}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
