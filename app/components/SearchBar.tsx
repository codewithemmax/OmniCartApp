"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition, useState, useRef, useEffect } from "react";

export default function SearchBar() {
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [mobileOpen, setMobileOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus mobile input when it opens
  useEffect(() => {
    if (mobileOpen) mobileInputRef.current?.focus();
  }, [mobileOpen]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const input = e.currentTarget.elements.namedItem("q") as HTMLInputElement;
    const q = input.value.trim();
    if (!q) return;
    setMobileOpen(false);
    startTransition(() => {
      const sp = new URLSearchParams(params.toString());
      sp.set("q", q);
      sp.delete("minPrice");
      sp.delete("maxPrice");
      sp.delete("maxDays");
      router.push(`/?${sp.toString()}`);
    });
  }

  const currentQuery = params.get("q") ?? "";

  return (
    <>
      {/* ── Desktop search bar (hidden on mobile) ── */}
      <form onSubmit={handleSubmit} className="hidden sm:flex gap-2 w-full">
        <input
          ref={inputRef}
          name="q"
          defaultValue={currentQuery}
          placeholder="Search Amazon, Jumia, Temu…"
          className="flex-1 min-w-0 px-4 py-2.5 rounded-xl border border-orange-200 focus:outline-none focus:ring-2 focus:ring-orange-400 text-gray-800 bg-white shadow-sm text-sm"
        />
        <button
          type="submit"
          disabled={isPending}
          className="shrink-0 px-5 py-2.5 bg-orange-500 text-white font-semibold rounded-xl hover:bg-orange-600 transition disabled:opacity-60 text-sm"
        >
          {isPending ? "…" : "Search"}
        </button>
      </form>

      {/* ── Mobile: magnifying glass icon only ── */}
      <button
        onClick={() => setMobileOpen(true)}
        className="sm:hidden flex items-center justify-center w-9 h-9 rounded-xl bg-orange-50 border border-orange-200 text-orange-500 hover:bg-orange-100 transition"
        aria-label="Open search"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </button>

      {/* ── Mobile: full-screen search overlay ── */}
      {mobileOpen && (
        <div className="sm:hidden fixed inset-0 z-50 bg-white flex flex-col">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-orange-100">
            <button
              onClick={() => setMobileOpen(false)}
              className="text-gray-500 hover:text-orange-500 transition p-1"
              aria-label="Close search"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M19 12H5M12 5l-7 7 7 7" />
              </svg>
            </button>
            <form onSubmit={handleSubmit} className="flex-1 flex gap-2">
              <input
                ref={mobileInputRef}
                name="q"
                defaultValue={currentQuery}
                placeholder="Search Amazon, Jumia, Temu…"
                className="flex-1 min-w-0 px-4 py-2.5 rounded-xl border border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-400 text-gray-800 bg-white text-sm"
              />
              <button
                type="submit"
                disabled={isPending}
                className="shrink-0 px-4 py-2.5 bg-orange-500 text-white font-semibold rounded-xl hover:bg-orange-600 transition disabled:opacity-60 text-sm"
              >
                {isPending ? "…" : "Go"}
              </button>
            </form>
          </div>

          {/* Quick suggestions */}
          <div className="px-4 py-4 space-y-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Popular searches</p>
            <div className="flex flex-wrap gap-2">
              {["iPhone", "Laptop", "Sneakers", "Smartwatch", "Headphones", "Skincare", "Gaming"].map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setMobileOpen(false);
                    startTransition(() => {
                      router.push(`/?q=${encodeURIComponent(s)}`);
                    });
                  }}
                  className="px-3 py-1.5 bg-orange-50 border border-orange-200 text-orange-600 text-sm font-medium rounded-full hover:bg-orange-500 hover:text-white transition"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
