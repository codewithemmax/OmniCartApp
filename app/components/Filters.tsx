"use client";

import { useRouter, useSearchParams } from "next/navigation";

export default function Filters() {
  const router = useRouter();
  const params = useSearchParams();

  function update(key: string, value: string) {
    const sp = new URLSearchParams(params.toString());
    value ? sp.set(key, value) : sp.delete(key);
    router.push(`/?${sp.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-3 items-center text-sm">
      <span className="text-gray-500 font-medium">Filter:</span>

      <select
        defaultValue={params.get("maxPrice") ?? ""}
        onChange={(e) => update("maxPrice", e.target.value)}
        className="px-3 py-2 rounded-lg border border-orange-200 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-300"
      >
        <option value="">Any Price</option>
        <option value="150000">Under ₦150,000</option>
        <option value="300000">Under ₦300,000</option>
        <option value="500000">Under ₦500,000</option>
      </select>

      <select
        defaultValue={params.get("maxDays") ?? ""}
        onChange={(e) => update("maxDays", e.target.value)}
        className="px-3 py-2 rounded-lg border border-orange-200 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-300"
      >
        <option value="">Any Delivery</option>
        <option value="2">≤ 2 days</option>
        <option value="5">≤ 5 days</option>
        <option value="14">≤ 14 days</option>
      </select>
    </div>
  );
}
