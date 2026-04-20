import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/app/lib/mongodb";
import SavedSearch from "@/app/lib/models/SavedSearch";
import { fetchAllProducts } from "@/app/lib/fetchProducts";
import { sendPriceDropEmail } from "@/app/lib/mailer";

export const runtime = "nodejs";

// Call this route via a cron job (e.g. Vercel Cron, GitHub Actions) every hour
// Protect with a secret header so only your cron can trigger it
export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await connectDB();
  const alerts = await SavedSearch.find({ active: true }).lean<{
    _id: { toString(): string };
    email: string;
    query: string;
    maxPrice: number;
    lastNotifiedPrice: number | null;
  }[]>();

  let notified = 0;

  for (const alert of alerts) {
    const products = await fetchAllProducts(alert.query);
    const cheapest = products
      .filter((p) => p.inStock)
      .sort((a, b) => a.price - b.price)[0];

    if (!cheapest) continue;
    if (cheapest.price > alert.maxPrice) continue;
    // Don't re-notify if price hasn't changed since last notification
    if (alert.lastNotifiedPrice !== null && cheapest.price >= alert.lastNotifiedPrice) continue;

    await sendPriceDropEmail(
      alert.email,
      alert.query,
      cheapest.price,
      alert.maxPrice,
      cheapest.url,
      cheapest.source
    );

    await SavedSearch.findByIdAndUpdate(alert._id, { lastNotifiedPrice: cheapest.price });
    notified++;
  }

  return NextResponse.json({ checked: alerts.length, notified });
}
