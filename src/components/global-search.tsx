"use client";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { useState } from "react";

export function GlobalSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (q.trim()) router.push(`/explore?q=${encodeURIComponent(q.trim())}`);
      }}
      className="flex w-full max-w-xl items-center gap-2 rounded-lg border border-line bg-slate-50 px-3 py-1.5 focus-within:border-brand-300 focus-within:bg-white"
    >
      <Search className="h-4 w-4 text-slate-400" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Ask Oracle anything — e.g. “properties with open roofing permits” or “contractors with complaints”"
        className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-slate-400"
      />
      <kbd className="hidden rounded border border-line bg-white px-1.5 py-0.5 text-[10px] text-slate-400 sm:inline">↵</kbd>
    </form>
  );
}
