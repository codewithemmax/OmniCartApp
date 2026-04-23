import { embed } from "ai";
import { google } from "@ai-sdk/google";
import { fetchAllProducts } from "./fetchProducts";
import { Product } from "./types";

function scoreRelevance(product: Product, query: string): number {
  const q = query.toLowerCase();
  const name = product.name.toLowerCase();
  let score = 0;

  // Full phrase match
  if (name.includes(q)) score += 1.0;

  // Individual word matches
  const words = q.split(/\s+/).filter(Boolean);
  const matched = words.filter((w) => name.includes(w)).length;
  score += (matched / Math.max(words.length, 1)) * 0.6;

  // Rating boost
  score += (product.rating / 5) * 0.15;

  // Review volume boost (log scale)
  score += Math.min(Math.log10(product.reviewCount + 1) / 5, 0.1);

  // Amazon slight boost (more review data)
  if (product.source === "Amazon") score += 0.05;

  return score;
}

export async function getShoppingContext(query: string, limit = 5): Promise<Product[]> {
  // Generate embedding for potential future Atlas Vector Search
  // (stored but not yet used for filtering — Atlas index setup required)
  try {
    await embed({
      model: google.textEmbeddingModel("text-embedding-004"),
      value: query,
    });
  } catch {
    // Non-blocking — embedding is optional enhancement
  }

  const products = await fetchAllProducts(query);
  if (!products.length) return [];

  return products
    .map((p) => ({ ...p, _score: scoreRelevance(p, query) }))
    .sort((a, b) => b._score - a._score)
    .slice(0, limit)
    .map(({ _score: _, ...p }) => p);
}

export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const { embedding } = await embed({
      model: google.textEmbeddingModel("text-embedding-004"),
      value: text,
    });
    return embedding;
  } catch {
    return [];
  }
}
