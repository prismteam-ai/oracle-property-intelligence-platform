import Link from "next/link";

const DOMAINS = [
  {
    href: "/properties",
    title: "Properties",
    detail: "Parcel-level ownership, permits, and improvement history.",
  },
  {
    href: "/businesses",
    title: "Businesses",
    detail: "Registrations, locations, and multi-property footprint.",
  },
  {
    href: "/contractors",
    title: "Contractors",
    detail: "Project history with BBB ratings, complaints, and review signals.",
  },
  {
    href: "/tenants",
    title: "Tenancy",
    detail: "Occupancy inferred from business registrations at parcel addresses.",
  },
] as const;

export function DomainLinkGrid(): React.ReactElement {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {DOMAINS.map((domain) => (
        <Link
          key={domain.href}
          href={domain.href}
          className="rounded-md border border-border/70 bg-card/80 px-4 py-4 transition-colors hover:border-primary/60 hover:bg-secondary/70"
        >
          <div className="text-sm font-semibold text-foreground">{domain.title}</div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{domain.detail}</p>
        </Link>
      ))}
    </div>
  );
}
