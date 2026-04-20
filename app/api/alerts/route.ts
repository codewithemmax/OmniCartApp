import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";
import { connectDB } from "@/app/lib/mongodb";
import SavedSearch from "@/app/lib/models/SavedSearch";

export const runtime = "nodejs";

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const alerts = await SavedSearch.find({ userId: session.user.id, active: true }).lean();
  return NextResponse.json(alerts);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { query, maxPrice } = await req.json();
  if (!query || !maxPrice) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  await connectDB();

  const existing = await SavedSearch.findOne({ userId: session.user.id, query, active: true });
  if (existing) {
    existing.maxPrice = maxPrice;
    await existing.save();
    return NextResponse.json(existing);
  }

  const alert = await SavedSearch.create({
    userId: session.user.id,
    email: session.user.email,
    query,
    maxPrice,
  });

  return NextResponse.json(alert, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  await connectDB();
  await SavedSearch.findOneAndUpdate({ _id: id, userId: session.user.id }, { active: false });
  return NextResponse.json({ success: true });
}
