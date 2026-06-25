"use client";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { useState } from "react";

export function AskBar({ initial = "" }: { initial?: string }) {
  const router = useRouter();
  const [q, setQ] = useState(initial);
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (q.trim()) router.push(`/explore?q=${encodeURIComponent(q.trim())}`); }}
      className="flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-3 shadow-sm focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-100"
    >
      <Sparkles className="h-5 w-5 text-brand-500" />
      <input
        autoFocus value={q} onChange={(e) => setQ(e.target.value)}
        placeholder="Ask about properties, permits, contractors, businesses, tenants, neighborhoods…"
        className="w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-slate-400"
      />
      <button type="submit" className="rounded-lg bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700">Ask</button>
    </form>
  );
}
