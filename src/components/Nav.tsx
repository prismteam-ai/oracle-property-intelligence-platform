import Link from "next/link";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/properties", label: "Properties" },
  { href: "/tenants", label: "Tenants" },
  { href: "/businesses", label: "Businesses" },
  { href: "/contractors", label: "Contractors" },
  { href: "/explore", label: "Explore" },
  { href: "/insights", label: "Insights" },
  { href: "/sources", label: "Sources" },
];

export function Nav() {
  return (
    <nav className="topnav">
      <span className="brand">Oracle</span>
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href}>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
