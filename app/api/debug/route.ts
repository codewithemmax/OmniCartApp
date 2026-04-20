import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const JUMIA_HOST = "jumia-e-commerce-data-api.p.rapidapi.com";
const AMAZON_HOST = "real-time-amazon-data.p.rapidapi.com";

export async function GET(req: NextRequest) {
  const key = process.env.RAPIDAPI_KEY;
  const q = req.nextUrl.searchParams.get("q") ?? "iphone";
  const api = req.nextUrl.searchParams.get("api") ?? "amazon";

  if (!key) return NextResponse.json({ error: "RAPIDAPI_KEY missing" });

  let url: string;
  let host: string;

  if (api === "jumia") {
    url = `https://${JUMIA_HOST}/produit?query=${encodeURIComponent(q)}`;
    host = JUMIA_HOST;
  } else {
    url = `https://${AMAZON_HOST}/search?query=${encodeURIComponent(q)}&page=1&country=US&sort_by=RELEVANCE&product_condition=ALL`;
    host = AMAZON_HOST;
  }

  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      "x-rapidapi-key": key,
      "x-rapidapi-host": host,
    },
  });

  const data = await res.json();
  const items = Array.isArray(data) ? data : data.data?.products ?? data.products ?? data;

  return NextResponse.json({
    status: res.status,
    itemCount: Array.isArray(items) ? items.length : 0,
    firstItem: Array.isArray(items) ? items[0] : data,
    rawTopKeys: Object.keys(data),
  });
}
