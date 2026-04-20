import { NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";
import { connectDB } from "@/app/lib/mongodb";
import SearchLog from "@/app/lib/models/SearchLog";
import User from "@/app/lib/models/User";

export const runtime = "nodejs";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

export async function GET() {
  const session = await auth();
  if (!session?.user?.email || session.user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await connectDB();

  const [
    totalSearches,
    totalUsers,
    topQueries,
    searchesPerDay,
    topUsers,
    recentSearches,
    zeroResultQueries,
  ] = await Promise.all([
    // Total search count
    SearchLog.countDocuments(),

    // Total registered users
    User.countDocuments(),

    // Top 10 most searched queries
    SearchLog.aggregate([
      { $group: { _id: "$query", count: { $sum: 1 }, avgResults: { $avg: "$resultsCount" } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]),

    // Searches per day (last 14 days)
    SearchLog.aggregate([
      { $match: { createdAt: { $gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),

    // Top 10 most active users
    SearchLog.aggregate([
      { $match: { userId: { $ne: "guest" } } },
      {
        $group: {
          _id: "$userId",
          userName: { $first: "$userName" },
          userEmail: { $first: "$userEmail" },
          searchCount: { $sum: 1 },
          queries: { $addToSet: "$query" },
          lastSearch: { $max: "$createdAt" },
        },
      },
      { $sort: { searchCount: -1 } },
      { $limit: 10 },
    ]),

    // Last 20 searches
    SearchLog.find()
      .sort({ createdAt: -1 })
      .limit(20)
      .lean(),

    // Queries that returned 0 results
    SearchLog.aggregate([
      { $match: { resultsCount: 0 } },
      { $group: { _id: "$query", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]),
  ]);

  return NextResponse.json({
    totalSearches,
    totalUsers,
    topQueries,
    searchesPerDay,
    topUsers,
    recentSearches,
    zeroResultQueries,
  });
}
