"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

export default function SearchBar() {
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = (e.currentTarget.elements.namedItem("q") as HTMLInputElement).value.trim();
    if (!q) return;
    startTransition(() => {
      const sp = new URLSearchParams(params.toString());
      sp.set("q", q);
      sp.delete("minPrice");
      sp.delete("maxPrice");
      sp.delete("maxDays");
      router.push(`/?${sp.toString()}`);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        name="q"
        defaultValue={params.get("q") ?? ""}
        placeholder="Search Jumia & Amazon…"
        className="flex-1 min-w-0 px-3 py-2.5 sm:px-4 sm:py-3 rounded-xl border border-orange-200 focus:outline-none focus:ring-2 focus:ring-orange-400 text-gray-800 bg-white shadow-sm text-sm sm:text-base"
      />
      <button
        type="submit"
        disabled={isPending}
        className="shrink-0 px-4 sm:px-6 py-2.5 sm:py-3 bg-orange-500 text-white font-semibold rounded-xl hover:bg-orange-600 transition disabled:opacity-60 text-sm sm:text-base"
      >
        {isPending ? "…" : "Search"}
      </button>
    </form>
  );
}
