import Link from "next/link";

import { WORKSPACE_COPY } from "@oracle/shared/workbench-copy";
import { WorkspacePanel } from "@/components/app/workspace-panel";

const PROMPTS = [
  "Show properties with open roofing permits",
  "Show contractors with negative BBB ratings",
  "Show businesses operating across multiple properties",
] as const;

export function QueryConsoleCard(): React.ReactElement {
  return (
    <WorkspacePanel title={WORKSPACE_COPY.inquiryTitle}>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Start with a natural-language question or pivot into the full canonical inquiry library.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {PROMPTS.map((prompt) => (
          <Link
            key={prompt}
            href={`/ask?q=${encodeURIComponent(prompt)}`}
            className="rounded-full border border-border/70 bg-background px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
          >
            {prompt}
          </Link>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <Link
          href="/ask"
          className="inline-flex h-9 items-center rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground"
        >
          Open inquiries
        </Link>
        <Link
          href="/insights"
          className="inline-flex h-9 items-center rounded-full border border-border px-4 text-sm text-muted-foreground transition-colors hover:bg-secondary"
        >
          Open inquiry library
        </Link>
      </div>
    </WorkspacePanel>
  );
}
