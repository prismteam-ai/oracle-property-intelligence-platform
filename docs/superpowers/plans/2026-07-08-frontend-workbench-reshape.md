# Frontend Workbench Reshape Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reshape the Next.js frontend into an analyst workbench so the product no longer reads as a close derivative of the earlier PR while keeping the existing demo data and route behavior working.

**Architecture:** Keep the current server-rendered route handlers and query layer intact, but replace the site shell, default route composition, and page framing with a denser workbench layout. Reuse existing list/detail data calls where possible, introduce focused shell/workspace components, and keep compatibility routes (`/ask`, `/tenants`, `/insights`) alive while changing visible labels and information architecture.

**Tech Stack:** Next.js App Router, React Server Components, TypeScript, Tailwind CSS, Vitest, existing `@oracle/query` route data functions

---

## File Map

- Modify: `apps/web/app/layout.tsx`  
  Replace the current top-nav/footer frame with the new persistent shell.

- Modify: `apps/web/app/page.tsx`  
  Rewrite the landing page into the workspace view.

- Modify: `apps/web/app/ask/page.tsx`  
  Reframe Ask as the inquiry console while preserving query behavior.

- Modify: `apps/web/app/insights/page.tsx`  
  Absorb insights behavior into the workbench framing and prepare compatibility handling.

- Modify: `apps/web/app/properties/page.tsx`  
  Shift the property index into a denser workbench surface.

- Modify: `apps/web/app/businesses/page.tsx`  
  Align business index page with the new workbench structure.

- Modify: `apps/web/app/contractors/page.tsx`  
  Align contractor index page with the new workbench structure.

- Modify: `apps/web/app/tenants/page.tsx`  
  Reframe page copy and structure as `Tenancy`.

- Modify: `apps/web/components/app/site-nav.tsx`  
  Replace the current header navigation with workbench navigation.

- Create: `apps/web/components/app/workbench-shell.tsx`  
  House the new app shell, rail, top bar, and content container.

- Create: `apps/web/components/app/workspace-panel.tsx`  
  Reusable panel container for dense workbench sections.

- Create: `apps/web/components/app/workspace-stat-strip.tsx`  
  Render compact summary metrics on the workspace route.

- Create: `apps/web/components/app/domain-link-grid.tsx`  
  Render workbench pivots into core domains.

- Create: `apps/web/components/app/query-console-card.tsx`  
  Render the inquiry-console framing used on `/` and `/ask`.

- Modify: `apps/web/app/globals.css`  
  Add shell layout, rail, panel, and tighter density styles.

- Create: `packages/shared/src/workbench-copy.test.ts`  
  Add focused regression tests for new navigation labels and workspace framing copy.

- Modify or Create: `apps/web/components/app/*.test.tsx` or `packages/shared/src/*.test.ts`  
  Keep tests colocated where the repo already supports them; use a low-friction test location if component test infra is limited.

## Task 1: Add failing tests for the new navigation and workspace framing

**Files:**
- Test: `packages/shared/src/workbench-copy.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";

const navigationLabels = [
  "Workspace",
  "Properties",
  "Businesses",
  "Contractors",
  "Tenancy",
  "Inquiries",
  "Sources",
];

const landingCopy = {
  title: "Workspace",
  inquiryTitle: "Inquiry console",
};

describe("workbench frontend copy contract", () => {
  it("uses the new workbench navigation labels", () => {
    expect(navigationLabels).toContain("Workspace");
    expect(navigationLabels).toContain("Tenancy");
    expect(navigationLabels).toContain("Inquiries");
    expect(navigationLabels).not.toContain("Insights");
    expect(navigationLabels).not.toContain("Ask");
    expect(navigationLabels).not.toContain("Tenants");
  });

  it("uses workspace framing on the default route", () => {
    expect(landingCopy.title).toBe("Workspace");
    expect(landingCopy.inquiryTitle).toBe("Inquiry console");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/shared/src/workbench-copy.test.ts`  
Expected: FAIL because the test file or assertions do not yet reflect exported app copy or constants.

- [ ] **Step 3: Write minimal implementation support for the test**

```ts
export const WORKBENCH_NAV_LABELS = [
  "Workspace",
  "Properties",
  "Businesses",
  "Contractors",
  "Tenancy",
  "Inquiries",
  "Sources",
] as const;

export const WORKSPACE_COPY = {
  title: "Workspace",
  inquiryTitle: "Inquiry console",
} as const;
```

Place these in a small shared module such as `apps/web/components/app/workbench-copy.ts` or `apps/web/lib/workbench.ts` and import them into the test and UI files.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/shared/src/workbench-copy.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/workbench-copy.test.ts apps/web/components/app/workbench-copy.ts
git commit -m "test: add frontend workbench copy contract"
```

## Task 2: Build the new workbench shell

**Files:**
- Create: `apps/web/components/app/workbench-shell.tsx`
- Modify: `apps/web/app/layout.tsx`
- Modify: `apps/web/components/app/site-nav.tsx`
- Modify: `apps/web/app/globals.css`
- Test: `packages/shared/src/workbench-copy.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { WORKBENCH_NAV_LABELS } from "../../apps/web/components/app/workbench-copy";

describe("workbench shell contract", () => {
  it("keeps the new left-rail navigation labels in order", () => {
    expect([...WORKBENCH_NAV_LABELS]).toEqual([
      "Workspace",
      "Properties",
      "Businesses",
      "Contractors",
      "Tenancy",
      "Inquiries",
      "Sources",
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/shared/src/workbench-copy.test.ts`  
Expected: FAIL until the shared copy module exists and exports the expected labels.

- [ ] **Step 3: Write minimal implementation**

```tsx
// apps/web/components/app/workbench-shell.tsx
import Link from "next/link";
import { WORKBENCH_NAV_LABELS, WORKBENCH_NAV_ITEMS } from "@/components/app/workbench-copy";

export function WorkbenchShell({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="workbench-shell">
      <aside className="workbench-rail">
        <Link href="/" className="workbench-brand">
          Oracle Property Intelligence
        </Link>
        <nav aria-label="Primary">
          <ul className="workbench-nav">
            {WORKBENCH_NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="workbench-nav-link">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
      <div className="workbench-main">
        <header className="workbench-topbar">
          <div className="workbench-topbar-title">Lee County dataset</div>
          <div className="workbench-topbar-status">Demo corpus active</div>
        </header>
        <main className="workbench-content">{children}</main>
      </div>
    </div>
  );
}
```

```tsx
// apps/web/app/layout.tsx
import { WorkbenchShell } from "@/components/app/workbench-shell";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans min-h-screen bg-background text-foreground">
        <WorkbenchShell>{children}</WorkbenchShell>
      </body>
    </html>
  );
}
```

```tsx
// apps/web/components/app/site-nav.tsx
export { WorkbenchShell as SiteNav } from "@/components/app/workbench-shell";
```

```css
/* apps/web/app/globals.css */
.workbench-shell {
  display: grid;
  min-height: 100vh;
  grid-template-columns: 248px minmax(0, 1fr);
}

.workbench-rail {
  border-right: 1px solid hsl(var(--border));
  background: hsl(var(--card));
  padding: 24px 16px;
}

.workbench-main {
  display: grid;
  grid-template-rows: 56px minmax(0, 1fr);
}

.workbench-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid hsl(var(--border));
  padding: 0 24px;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/shared/src/workbench-copy.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/layout.tsx apps/web/components/app/site-nav.tsx apps/web/components/app/workbench-shell.tsx apps/web/app/globals.css apps/web/components/app/workbench-copy.ts packages/shared/src/workbench-copy.test.ts
git commit -m "feat: add frontend workbench shell"
```

## Task 3: Rewrite the default route into the workspace

**Files:**
- Modify: `apps/web/app/page.tsx`
- Create: `apps/web/components/app/workspace-panel.tsx`
- Create: `apps/web/components/app/workspace-stat-strip.tsx`
- Create: `apps/web/components/app/domain-link-grid.tsx`
- Create: `apps/web/components/app/query-console-card.tsx`
- Test: `packages/shared/src/workbench-copy.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { WORKSPACE_COPY } from "../../apps/web/components/app/workbench-copy";

describe("workspace route copy", () => {
  it("frames the homepage as a workspace instead of a hero page", () => {
    expect(WORKSPACE_COPY.title).toBe("Workspace");
    expect(WORKSPACE_COPY.sections).toEqual(
      expect.arrayContaining([
        "Inquiry console",
        "Property watchlist",
        "Contractor risk",
      ]),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/shared/src/workbench-copy.test.ts`  
Expected: FAIL until `sections` exists and matches the workspace composition.

- [ ] **Step 3: Write minimal implementation**

```tsx
// apps/web/app/page.tsx
import Link from "next/link";
import { WORKSPACE_COPY } from "@/components/app/workbench-copy";
import { WorkspacePanel } from "@/components/app/workspace-panel";
import { WorkspaceStatStrip } from "@/components/app/workspace-stat-strip";
import { DomainLinkGrid } from "@/components/app/domain-link-grid";
import { QueryConsoleCard } from "@/components/app/query-console-card";

export default function HomePage(): React.ReactElement {
  return (
    <div className="space-y-6 px-6 py-6">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Workspace</p>
        <h1 className="text-3xl font-semibold">{WORKSPACE_COPY.title}</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Start from an inquiry, pivot into a record domain, and inspect source-backed evidence.
        </p>
      </header>

      <WorkspaceStatStrip />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.9fr)]">
        <div className="space-y-6">
          <QueryConsoleCard />
          <WorkspacePanel title="Property watchlist">
            <Link href="/properties" className="text-sm underline underline-offset-2">
              Review active parcels
            </Link>
          </WorkspacePanel>
        </div>
        <div className="space-y-6">
          <WorkspacePanel title="Contractor risk">
            <Link href="/contractors" className="text-sm underline underline-offset-2">
              Review contractor signals
            </Link>
          </WorkspacePanel>
          <DomainLinkGrid />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/shared/src/workbench-copy.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/page.tsx apps/web/components/app/workspace-panel.tsx apps/web/components/app/workspace-stat-strip.tsx apps/web/components/app/domain-link-grid.tsx apps/web/components/app/query-console-card.tsx apps/web/components/app/workbench-copy.ts packages/shared/src/workbench-copy.test.ts
git commit -m "feat: replace homepage with analyst workspace"
```

## Task 4: Reframe `/ask` as the inquiry console and preserve compatibility

**Files:**
- Modify: `apps/web/app/ask/page.tsx`
- Modify: `apps/web/components/app/workbench-copy.ts`
- Test: `packages/shared/src/workbench-copy.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { WORKBENCH_NAV_ITEMS } from "../../apps/web/components/app/workbench-copy";

describe("inquiries route contract", () => {
  it("keeps ask routed but labels the surface as inquiries", () => {
    const inquiriesItem = WORKBENCH_NAV_ITEMS.find((item) => item.href === "/ask");
    expect(inquiriesItem?.label).toBe("Inquiries");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/shared/src/workbench-copy.test.ts`  
Expected: FAIL because `/ask` is still labeled `Ask`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// apps/web/app/ask/page.tsx
export const metadata: Metadata = { title: "Inquiries" };

<PageHeader
  eyebrow="Inquiry console"
  title="Inquiries"
  description="Run natural-language questions against retrieved records and inspect grounded evidence."
/>;
```

Also update the example-chip framing, empty-state copy, and submit label so the page reads like an investigation surface rather than a demo prompt.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/shared/src/workbench-copy.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/ask/page.tsx apps/web/components/app/workbench-copy.ts packages/shared/src/workbench-copy.test.ts
git commit -m "feat: reframe ask as inquiries console"
```

## Task 5: Fold insights into the workbench framing

**Files:**
- Modify: `apps/web/app/insights/page.tsx`
- Modify: `apps/web/app/page.tsx`
- Modify: `apps/web/components/app/workbench-copy.ts`
- Test: `packages/shared/src/workbench-copy.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { WORKBENCH_NAV_LABELS } from "../../apps/web/components/app/workbench-copy";

describe("insights compatibility contract", () => {
  it("removes insights from primary navigation", () => {
    expect(WORKBENCH_NAV_LABELS).not.toContain("Insights");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/shared/src/workbench-copy.test.ts`  
Expected: FAIL if `Insights` still appears in the primary label set.

- [ ] **Step 3: Write minimal implementation**

```tsx
// apps/web/app/insights/page.tsx
export const metadata: Metadata = { title: "Workspace Inquiries" };

<PageHeader
  eyebrow="Inquiry library"
  title="Required inquiries"
  description="Run the canonical inquiry set and pivot into grounded records."
/>;
```

Keep the route live, but visually align it with the workbench and remove it from primary navigation.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/shared/src/workbench-copy.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/insights/page.tsx apps/web/components/app/workbench-copy.ts packages/shared/src/workbench-copy.test.ts
git commit -m "feat: fold insights into workbench navigation"
```

## Task 6: Reshape the entity index pages into denser work surfaces

**Files:**
- Modify: `apps/web/app/properties/page.tsx`
- Modify: `apps/web/app/businesses/page.tsx`
- Modify: `apps/web/app/contractors/page.tsx`
- Modify: `apps/web/app/tenants/page.tsx`
- Create or Modify: `apps/web/components/app/workspace-panel.tsx`
- Test: `packages/shared/src/workbench-copy.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { WORKBENCH_NAV_LABELS } from "../../apps/web/components/app/workbench-copy";

describe("tenancy labeling contract", () => {
  it("uses Tenancy instead of Tenants in the primary shell", () => {
    expect(WORKBENCH_NAV_LABELS).toContain("Tenancy");
    expect(WORKBENCH_NAV_LABELS).not.toContain("Tenants");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/shared/src/workbench-copy.test.ts`  
Expected: FAIL while navigation still exposes `Tenants`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// apps/web/app/tenants/page.tsx
export const metadata: Metadata = { title: "Tenancy" };

<PageHeader
  eyebrow="Occupancy signals"
  title="Tenancy"
  description={`${total.toLocaleString("en-US")} inferred occupancy records derived from business registrations at parcel addresses.`}
/>;
```

Apply the same workbench composition pattern to all four index pages:

```tsx
<div className="space-y-6 px-6 py-6">
  <PageHeader ... />
  <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
    <section className="space-y-4">
      <FilterBar ... />
      {tableOrEmptyState}
      <Pager ... />
    </section>
    <aside className="space-y-4">
      <WorkspacePanel title="How to use this view">
        <p className="text-sm text-muted-foreground">...</p>
      </WorkspacePanel>
      <WorkspacePanel title="Signal summary">
        <p className="text-sm text-muted-foreground">...</p>
      </WorkspacePanel>
    </aside>
  </div>
</div>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/shared/src/workbench-copy.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/properties/page.tsx apps/web/app/businesses/page.tsx apps/web/app/contractors/page.tsx apps/web/app/tenants/page.tsx apps/web/components/app/workbench-copy.ts apps/web/components/app/workspace-panel.tsx packages/shared/src/workbench-copy.test.ts
git commit -m "feat: convert entity indexes to workbench layouts"
```

## Task 7: Run full verification

**Files:**
- No code changes required unless verification exposes defects.

- [ ] **Step 1: Run targeted tests**

Run: `npx vitest run packages/shared/src/workbench-copy.test.ts packages/query/src/demo.test.ts`  
Expected: PASS

- [ ] **Step 2: Run the full test suite**

Run: `pnpm test`  
Expected: PASS

- [ ] **Step 3: Run lint**

Run: `pnpm lint`  
Expected: PASS

- [ ] **Step 4: Run typecheck**

Run: `pnpm typecheck`  
Expected: PASS

- [ ] **Step 5: Run the web build**

Run: `pnpm --filter @oracle/web build`  
Expected: PASS

- [ ] **Step 6: Commit final fixes if verification required any**

```bash
git add apps/web packages/shared
git commit -m "fix: address workbench verification issues"
```

## Self-Review

- Spec coverage: the shell, workspace route, navigation rename, inquiry reframing, insights absorption, and denser entity-page structure are all covered by Tasks 2 through 6. No design requirement is left without a task.
- Placeholder scan: each task includes concrete file targets, test intent, commands, and implementation snippets. No `TODO` or vague “handle appropriately” language remains.
- Type consistency: `WORKBENCH_NAV_LABELS`, `WORKBENCH_NAV_ITEMS`, and `WORKSPACE_COPY` are the shared symbols used across the plan; later tasks reference the same names consistently.
