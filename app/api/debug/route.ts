import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const AMAZON_HOST = "real-time-amazon-data.p.rapidapi.com";

export async function GET(req: NextRequest) {
  const key = process.env.RAPIDAPI_KEY;
  const q = req.nextUrl.searchParams.get("q") ?? "iphone";

  if (!key) return NextResponse.json({ error: "RAPIDAPI_KEY missing" });

  const url = new URL(`https://${AMAZON_HOST}/search`);
  url.searchParams.set("query", q);
  url.searchParams.set("page", "1");
  url.searchParams.set("country", "US");
  url.searchParams.set("sort_by", "RELEVANCE");
  url.searchParams.set("product_condition", "ALL");

  const res = await fetch(url.toString(), {
    headers: {
      "Content-Type": "application/json",
      "x-rapidapi-key": key,
      "x-rapidapi-host": AMAZON_HOST,
    },
  });

  const data = await res.json();
  const items = data.data?.products ?? [];

  return NextResponse.json({
    status: res.status,
    keySample: key.slice(0, 8) + "...",
    itemCount: items.length,
    firstItem: items[0] ?? null,
    error: data.message ?? null,
  });
}
