import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/app/lib/mongodb";
import User from "@/app/lib/models/User";

export const runtime = "nodejs";

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}

export async function POST(req: NextRequest) {
  try {
    const { name, email, password } = await req.json();

    if (!name || !email || !password)
      return NextResponse.json({ error: "All fields are required." }, { status: 400 });

    if (password.length < 6)
      return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });

    await connectDB();

    const existing = await User.findOne({ email });
    if (existing)
      return NextResponse.json({ error: "Email already registered." }, { status: 409 });

    const hashed = await bcrypt.hash(password, 12);
    await User.create({ name, email, password: hashed });

    return NextResponse.json({ message: "Account created." }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[register] error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
