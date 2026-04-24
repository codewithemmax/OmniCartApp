import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const ALIEXPRESS_HOST = "aliexpress-datahub.p.rapidapi.com";

export async function GET(req: NextRequest) {
  const key = process.env.RAPIDAPI_KEY;
  const q = req.nextUrl.searchParams.get("q") ?? "iphone";

  if (!key) return NextResponse.json({ error: "RAPIDAPI_KEY missing" });

  const url = new URL(`https://${ALIEXPRESS_HOST}/item/search`);
  url.searchParams.set("q", q);
  url.searchParams.set("page", "1");

  const res = await fetch(url.toString(), {
    headers: {
      "Content-Type": "application/json",
      "x-rapidapi-key": key,
      "x-rapidapi-host": ALIEXPRESS_HOST,
    },
  });

  const data = await res.json();
  const items =
    data?.result?.resultList ??
    data?.data?.result?.resultList ??
    data?.items ??
    [];

  return NextResponse.json({
    status: res.status,
    itemCount: Array.isArray(items) ? items.length : 0,
    rawTopKeys: Object.keys(data),
    firstItem: Array.isArray(items) ? items[0] : data,
  });
}
