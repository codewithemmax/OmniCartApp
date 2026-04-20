import { connectDB } from "./mongodb";
import SearchLog from "./models/SearchLog";
import { fetchAllProducts } from "./fetchProducts";
import { Product } from "./types";

export interface RecommendedSection {
  query: string;
  products: Product[];
}

export async function getPersonalizedRecommendations(
  userId: string
): Promise<RecommendedSection[]> {
  await connectDB();

  // Get the user's top 3 most repeated queries (excluding very short ones)
  const topQueries = await SearchLog.aggregate([
    { $match: { userId, resultsCount: { $gt: 0 } } },
    { $group: { _id: "$query", count: { $sum: 1 }, lastSearched: { $max: "$createdAt" } } },
    { $match: { _id: { $regex: /\S{3,}/ } } }, // at least 3 chars
    { $sort: { count: -1, lastSearched: -1 } },
    { $limit: 3 },
  ]);

  if (!topQueries.length) return [];

  // Fetch products for each top query in parallel
  const results = await Promise.allSettled(
    topQueries.map((q: { _id: string }) =>
      fetchAllProducts(q._id).then((products) => ({
        query: q._id,
        products: products.slice(0, 6),
      }))
    )
  );

  return results
    .filter(
      (r): r is PromiseFulfilledResult<RecommendedSection> =>
        r.status === "fulfilled" && r.value.products.length > 0
    )
    .map((r) => r.value);
}
