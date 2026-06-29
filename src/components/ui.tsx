import type { ReactNode } from "react";

export function Stat({
  label,
  value,
  testid,
  href,
}: {
  label: string;
  value: ReactNode;
  testid?: string;
  href?: string;
}) {
  const inner = (
    <div className="stat" data-testid={testid}>
      <div className="stat-value">{value}</div>
      <div className="muted stat-label">{label}</div>
    </div>
  );
  return href ? (
    <a href={href} className="stat-link">
      {inner}
    </a>
  ) : (
    inner
  );
}

export function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="field">
      <span className="muted field-label">{label}</span>
      <span className="field-value">{value ?? "—"}</span>
    </div>
  );
}

/** A section card with a heading and an optional count badge. */
export function Section({
  title,
  count,
  testid,
  children,
}: {
  title: string;
  count?: number;
  testid?: string;
  children: ReactNode;
}) {
  return (
    <section className="card" data-testid={testid}>
      <h2>
        {title}
        {typeof count === "number" ? <span className="muted"> ({count})</span> : null}
      </h2>
      {children}
    </section>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="muted">{children}</p>;
}
