import { handlers } from "@/app/lib/auth";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const { GET, POST } = handlers;

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
