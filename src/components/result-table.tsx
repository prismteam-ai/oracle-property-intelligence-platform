import Link from "next/link";
import { Table, Th, Td, Badge, EmptyState } from "@/components/ui";
import { fmtUsd, fmtNum, fmtDate, bbbColor, cn } from "@/lib/utils";
import type { Col } from "@/lib/inquiries";

function renderCell(col: Col, value: any) {
  if (value == null || value === "") return <span className="text-slate-300">—</span>;
  switch (col.type) {
    case "money": return fmtUsd(Number(value));
    case "num": return fmtNum(Number(value));
    case "date": return fmtDate(value);
    case "rating":
      return <span className={cn("inline-flex rounded border px-1.5 py-0.5 text-[11px] font-semibold", bbbColor(String(value)))}>{value}</span>;
    case "badge": return <Badge>{String(value)}</Badge>;
    default: return String(value);
  }
}

export function ResultTable({ columns, rows }: { columns: Col[]; rows: Record<string, any>[] }) {
  if (!rows.length) return <EmptyState title="No matching records" hint="Try a different filter or question." />;
  return (
    <Table>
      <thead>
        <tr>
          {columns.map((c) => (
            <Th key={c.key} align={c.type === "num" || c.type === "money" ? "right" : "left"}>{c.label}</Th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="group hover:bg-slate-50/70">
            {columns.map((c, ci) => (
              <Td key={c.key} align={c.type === "num" || c.type === "money" ? "right" : "left"}>
                {ci === 0 && r.href ? (
                  <Link href={r.href} className="font-medium text-brand-600 hover:underline">
                    {renderCell(c, r[c.key])}
                  </Link>
                ) : (
                  renderCell(c, r[c.key])
                )}
              </Td>
            ))}
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
