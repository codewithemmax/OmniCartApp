import { redirect } from "next/navigation";
import { auth } from "@/app/lib/auth";
import { connectDB } from "@/app/lib/mongodb";
import SearchLog from "@/app/lib/models/SearchLog";
import User from "@/app/lib/models/User";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user?.email || session.user.email !== ADMIN_EMAIL) {
    redirect("/");
  }

  await connectDB();

  const [
    totalSearches,
    totalUsers,
    topQueries,
    topUsers,
    recentSearches,
    zeroResultQueries,
    searchesPerDay,
  ] = await Promise.all([
    SearchLog.countDocuments(),
    User.countDocuments(),
    SearchLog.aggregate([
      { $group: { _id: "$query", count: { $sum: 1 }, avgResults: { $avg: "$resultsCount" } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]),
    SearchLog.aggregate([
      { $match: { userId: { $ne: "guest" } } },
      {
        $group: {
          _id: "$userId",
          userName: { $first: "$userName" },
          userEmail: { $first: "$userEmail" },
          searchCount: { $sum: 1 },
          lastSearch: { $max: "$createdAt" },
          queries: { $addToSet: "$query" },
        },
      },
      { $sort: { searchCount: -1 } },
      { $limit: 10 },
    ]),
    SearchLog.find().sort({ createdAt: -1 }).limit(20).lean(),
    SearchLog.aggregate([
      { $match: { resultsCount: 0 } },
      { $group: { _id: "$query", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 },
    ]),
    SearchLog.aggregate([
      { $match: { createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
  ]);

  const maxDayCount = Math.max(...searchesPerDay.map((d: { count: number }) => d.count), 1);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-orange-100 shadow-sm px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/" className="text-2xl font-extrabold text-orange-500">OmniCart</a>
          <span className="bg-orange-100 text-orange-600 text-xs font-bold px-2 py-1 rounded-full">Admin</span>
        </div>
        <a href="/" className="text-sm text-gray-500 hover:text-orange-500 transition">← Back to app</a>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        <h1 className="text-2xl font-extrabold text-gray-800">Search Analytics Dashboard</h1>

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total Searches", value: totalSearches, icon: "🔍" },
            { label: "Registered Users", value: totalUsers, icon: "👤" },
            { label: "Unique Queries", value: topQueries.length, icon: "📊" },
            { label: "Zero-Result Queries", value: zeroResultQueries.length, icon: "⚠️" },
          ].map((stat) => (
            <div key={stat.label} className="bg-white rounded-2xl p-5 shadow-sm border border-orange-50">
              <p className="text-3xl">{stat.icon}</p>
              <p className="text-3xl font-extrabold text-gray-800 mt-2">{stat.value}</p>
              <p className="text-sm text-gray-400 mt-1">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Searches per day bar chart */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-orange-50">
          <h2 className="text-base font-bold text-gray-800 mb-4">Searches — Last 7 Days</h2>
          {searchesPerDay.length === 0 ? (
            <p className="text-gray-400 text-sm">No data yet.</p>
          ) : (
            <div className="flex items-end gap-2 h-32">
              {searchesPerDay.map((day: { _id: string; count: number }) => (
                <div key={day._id} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs font-bold text-orange-600">{day.count}</span>
                  <div
                    className="w-full bg-orange-400 rounded-t-md"
                    style={{ height: `${(day.count / maxDayCount) * 100}%`, minHeight: "4px" }}
                  />
                  <span className="text-[10px] text-gray-400">{day._id.slice(5)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top queries */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-orange-50">
            <h2 className="text-base font-bold text-gray-800 mb-4">🔥 Top Searched Queries</h2>
            {topQueries.length === 0 ? (
              <p className="text-gray-400 text-sm">No searches yet.</p>
            ) : (
              <div className="space-y-2">
                {topQueries.map((q: { _id: string; count: number; avgResults: number }, i: number) => (
                  <div key={q._id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-gray-300 w-5">#{i + 1}</span>
                      <span className="text-sm font-medium text-gray-700 capitalize">{q._id}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span>{Math.round(q.avgResults)} results avg</span>
                      <span className="bg-orange-100 text-orange-600 font-bold px-2 py-0.5 rounded-full">
                        {q.count}x
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Zero result queries */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-orange-50">
            <h2 className="text-base font-bold text-gray-800 mb-4">⚠️ Searches With No Results</h2>
            {zeroResultQueries.length === 0 ? (
              <p className="text-gray-400 text-sm">All searches returned results. 🎉</p>
            ) : (
              <div className="space-y-2">
                {zeroResultQueries.map((q: { _id: string; count: number }) => (
                  <div key={q._id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <span className="text-sm font-medium text-gray-700 capitalize">{q._id}</span>
                    <span className="bg-red-100 text-red-500 font-bold text-xs px-2 py-0.5 rounded-full">
                      {q.count}x
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Top users */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-orange-50">
          <h2 className="text-base font-bold text-gray-800 mb-4">👤 Most Active Users</h2>
          {topUsers.length === 0 ? (
            <p className="text-gray-400 text-sm">No logged-in searches yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                    <th className="pb-2 font-semibold">User</th>
                    <th className="pb-2 font-semibold">Email</th>
                    <th className="pb-2 font-semibold">Searches</th>
                    <th className="pb-2 font-semibold">Unique Queries</th>
                    <th className="pb-2 font-semibold">Last Active</th>
                  </tr>
                </thead>
                <tbody>
                  {topUsers.map((u: {
                    _id: string;
                    userName: string;
                    userEmail: string;
                    searchCount: number;
                    queries: string[];
                    lastSearch: string;
                  }) => (
                    <tr key={u._id} className="border-b border-gray-50 last:border-0">
                      <td className="py-2.5 font-medium text-gray-700">{u.userName}</td>
                      <td className="py-2.5 text-gray-400">{u.userEmail}</td>
                      <td className="py-2.5">
                        <span className="bg-orange-100 text-orange-600 font-bold text-xs px-2 py-0.5 rounded-full">
                          {u.searchCount}
                        </span>
                      </td>
                      <td className="py-2.5 text-gray-500">{u.queries.length}</td>
                      <td className="py-2.5 text-gray-400 text-xs">
                        {new Date(u.lastSearch).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent searches */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-orange-50">
          <h2 className="text-base font-bold text-gray-800 mb-4">🕐 Recent Searches</h2>
          {recentSearches.length === 0 ? (
            <p className="text-gray-400 text-sm">No searches yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                    <th className="pb-2 font-semibold">Query</th>
                    <th className="pb-2 font-semibold">User</th>
                    <th className="pb-2 font-semibold">Results</th>
                    <th className="pb-2 font-semibold">Filters</th>
                    <th className="pb-2 font-semibold">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {recentSearches.map((s: {
                    _id: string;
                    query: string;
                    userName: string;
                    resultsCount: number;
                    filters: { maxPrice?: number; maxDays?: number };
                    createdAt: string;
                  }) => (
                    <tr key={String(s._id)} className="border-b border-gray-50 last:border-0">
                      <td className="py-2.5 font-medium text-gray-700 capitalize">{s.query}</td>
                      <td className="py-2.5 text-gray-400">{s.userName}</td>
                      <td className="py-2.5">
                        <span className={`font-bold text-xs px-2 py-0.5 rounded-full ${s.resultsCount === 0 ? "bg-red-100 text-red-500" : "bg-green-100 text-green-600"}`}>
                          {s.resultsCount}
                        </span>
                      </td>
                      <td className="py-2.5 text-gray-400 text-xs">
                        {s.filters?.maxPrice ? `≤₦${s.filters.maxPrice.toLocaleString()}` : "—"}
                        {s.filters?.maxDays ? ` · ≤${s.filters.maxDays}d` : ""}
                      </td>
                      <td className="py-2.5 text-gray-400 text-xs">
                        {new Date(s.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
