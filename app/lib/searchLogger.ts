"use server";

import { connectDB } from "./mongodb";
import SearchLog from "./models/SearchLog";

export async function logSearch(params: {
  userId: string;
  userName: string;
  userEmail: string;
  query: string;
  resultsCount: number;
  maxPrice?: string;
  maxDays?: string;
}) {
  try {
    await connectDB();
    await SearchLog.create({
      userId: params.userId,
      userName: params.userName,
      userEmail: params.userEmail,
      query: params.query,
      resultsCount: params.resultsCount,
      filters: {
        maxPrice: params.maxPrice ? Number(params.maxPrice) : null,
        maxDays: params.maxDays ? Number(params.maxDays) : null,
      },
    });
  } catch {
    // Non-critical — never break the page if logging fails
  }
}
