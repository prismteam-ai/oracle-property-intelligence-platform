const STATS = [
  { label: "Properties", value: "320", note: "expanded hosted demo corpus" },
  { label: "Permits", value: "1.9k", note: "weighted toward open and high-signal work" },
  { label: "Businesses", value: "600+", note: "location-linked registrations" },
  { label: "Contractors", value: "150+", note: "BBB-linked demo profiles" },
] as const;

export function WorkspaceStatStrip(): React.ReactElement {
  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {STATS.map((stat) => (
        <div
          key={stat.label}
          className="rounded-md border border-border/70 bg-card/80 px-4 py-3"
        >
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            {stat.label}
          </div>
          <div className="mt-2 text-2xl font-semibold text-foreground">{stat.value}</div>
          <div className="mt-1 text-xs text-muted-foreground">{stat.note}</div>
        </div>
      ))}
    </section>
  );
}
