"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";

interface Props {
  query: string;
  lowestPrice: number;
}

export default function AlertButton({ query, lowestPrice }: Props) {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [maxPrice, setMaxPrice] = useState(String(lowestPrice));
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  if (!session) return null;

  async function save() {
    setStatus("saving");
    const res = await fetch("/api/alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, maxPrice: Number(maxPrice) }),
    });
    setStatus(res.ok ? "saved" : "error");
    if (res.ok) setTimeout(() => setOpen(false), 1200);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-orange-600 border border-orange-300 rounded-lg hover:bg-orange-50 transition"
      >
        🔔 Set Price Alert
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-20 bg-white border border-orange-200 rounded-xl shadow-lg p-4 w-72">
          <p className="text-sm font-semibold text-gray-700 mb-1">
            Alert me when &ldquo;{query}&rdquo; drops below:
          </p>
          <div className="flex gap-2 mt-2">
            <span className="flex items-center px-2 bg-orange-50 border border-orange-200 rounded-lg text-orange-600 font-bold text-sm">
              ₦
            </span>
            <input
              type="number"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              className="flex-1 px-3 py-2 border border-orange-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
            />
          </div>
          <button
            onClick={save}
            disabled={status === "saving" || status === "saved"}
            className="w-full mt-3 py-2 bg-orange-500 text-white text-sm font-semibold rounded-lg hover:bg-orange-600 transition disabled:opacity-60"
          >
            {status === "saving" ? "Saving…" : status === "saved" ? "✓ Alert Saved!" : "Save Alert"}
          </button>
          {status === "error" && (
            <p className="text-red-500 text-xs mt-1 text-center">Something went wrong.</p>
          )}
        </div>
      )}
    </div>
  );
}
