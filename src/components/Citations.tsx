import type { Citation } from "@/server/ports";

export function Citations({ items }: { items: Citation[] }) {
  if (!items.length) return <span className="muted">No citations</span>;
  return (
    <ul>
      {items.map((c, i) => (
        <li key={`${c.url}-${i}`}>
          {c.url ? (
            <a href={c.url} target="_blank" rel="noreferrer">
              {c.label}
            </a>
          ) : (
            <span>{c.label}</span>
          )}
          {c.recordKey ? <span className="muted"> · {c.recordKey}</span> : null}
        </li>
      ))}
    </ul>
  );
}
