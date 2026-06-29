import Link from "next/link";

import { FilterBar } from "@/components/FilterBar";
import { Section, Stat } from "@/components/ui";
import { DEMO_INQUIRIES, STRETCH_INQUIRIES, inquiryDeepLink } from "@/lib/inquiries";
import { data } from "@/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [stats, facets] = await Promise.all([
    data.getDashboardStats(),
    data.getFilterFacets(),
  ]);

  return (
    <div data-testid="dashboard">
      <h1>Oracle Property Intelligence Platform</h1>
      <p className="muted">
        RAG + exploration over Lee County property, permit, Sunbiz, and BBB data, modeled on the
        Elephant Lexicon (mirrors @elephant-xyz/query-db).
      </p>

      <Section title="Dataset at a glance" testid="dashboard-stats">
        <div className="grid">
          <Stat label="Properties" value={stats.properties.toLocaleString()} testid="stat-properties" href="/properties" />
          <Stat label="Permits" value={stats.permits.toLocaleString()} testid="stat-permits" />
          <Stat label="Open permits" value={stats.openPermits.toLocaleString()} testid="stat-open-permits" />
          <Stat label="Contractors" value={stats.contractors.toLocaleString()} testid="stat-contractors" href="/contractors" />
          <Stat
            label="Negative-BBB contractors"
            value={stats.negativeContractors.toLocaleString()}
            testid="stat-negative-contractors"
            href="/contractors?rating=negative&sort=complaints"
          />
          <Stat label="Businesses" value={stats.businesses.toLocaleString()} testid="stat-businesses" href="/businesses" />
          <Stat label="Tenants" value={stats.tenants.toLocaleString()} testid="stat-tenants" href="/tenants" />
          <Stat label="Projects" value={stats.projects.toLocaleString()} testid="stat-projects" />
          <Stat label="Major renovations" value={stats.majorRenovations.toLocaleString()} testid="stat-major-renos" />
          <Stat
            label="Properties w/ >1 open permit"
            value={stats.multiOpenPermitProperties.toLocaleString()}
            testid="stat-multi-open"
            href="/insights#props-multi-open-permit"
          />
        </div>
      </Section>

      <Section title="Explore the data" testid="dashboard-explore">
        <div className="grid">
          <Link className="chip" href="/properties" data-testid="nav-properties">
            Properties
          </Link>
          <Link className="chip" href="/tenants" data-testid="nav-tenants">
            Tenants
          </Link>
          <Link className="chip" href="/businesses" data-testid="nav-businesses">
            Businesses
          </Link>
          <Link className="chip" href="/contractors" data-testid="nav-contractors">
            Contractors
          </Link>
        </div>
      </Section>

      <Section title="Ask a question" testid="dashboard-ask">
        <form method="get" action="/explore">
          <input
            type="search"
            name="q"
            placeholder="e.g. Show all properties with open roofing permits"
            style={{ width: "70%" }}
            data-testid="ask-input"
          />{" "}
          <button type="submit" data-testid="ask-submit">
            Ask
          </button>
        </form>
        <p className="muted" style={{ marginTop: 8 }}>
          Source-backed answers with citations via the RAG layer.
        </p>
      </Section>

      {/* Cross-cutting filter (AC #53): deep-links into the Properties view. */}
      <Section title="Filter the portfolio" testid="dashboard-filter">
        <FilterBar action="/properties" facets={facets} />
      </Section>

      <Section title="Demo inquiries" testid="dashboard-inquiries">
        <div>
          {DEMO_INQUIRIES.map((i) => (
            <Link
              key={i.id}
              className="chip"
              href={inquiryDeepLink(i)}
              data-testid="inquiry-chip"
            >
              {i.ordinal}. {i.label}
            </Link>
          ))}
        </div>
      </Section>

      <Section title="Stretch inquiries" testid="dashboard-stretch-inquiries">
        <div>
          {STRETCH_INQUIRIES.map((i) => (
            <Link
              key={i.id}
              className="chip"
              href={inquiryDeepLink(i)}
              data-testid="stretch-inquiry-chip"
            >
              {i.ordinal}. {i.label}
            </Link>
          ))}
        </div>
      </Section>
    </div>
  );
}
