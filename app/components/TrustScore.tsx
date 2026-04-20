import { Product } from "../lib/types";

// Weighted trust score: 60% rating, 40% review volume (log-scaled)
function trustScore(products: Product[]): { score: number; totalReviews: number } {
  if (!products.length) return { score: 0, totalReviews: 0 };

  const totalReviews = products.reduce((s, p) => s + p.reviewCount, 0);
  const weightedRating =
    products.reduce((s, p) => s + p.rating * p.reviewCount, 0) / (totalReviews || 1);

  // Normalize review volume: 5000+ reviews = full confidence
  const volumeScore = Math.min(totalReviews / 5000, 1);
  const score = weightedRating * 0.6 + volumeScore * 5 * 0.4;

  return { score: Math.min(score, 5), totalReviews };
}

function Stars({ score }: { score: number }) {
  return (
    <span className="text-orange-400 text-xs tracking-tight">
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = Math.min(Math.max(score - (i - 1), 0), 1);
        return (
          <span key={i} style={{ opacity: 0.3 + fill * 0.7 }}>
            ★
          </span>
        );
      })}
    </span>
  );
}

export default function TrustScore({ products }: { products: Product[] }) {
  const { score, totalReviews } = trustScore(products);
  if (!totalReviews) return null;

  const label = score >= 4.5 ? "Excellent" : score >= 4 ? "Very Good" : score >= 3 ? "Good" : "Mixed";

  return (
    <div className="flex items-center gap-1.5 mt-1">
      <Stars score={score} />
      <span className="text-[11px] font-semibold text-gray-600">{score.toFixed(1)}</span>
      <span className="text-[11px] text-gray-400">
        {label} · {totalReviews.toLocaleString()} reviews across all platforms
      </span>
    </div>
  );
}
