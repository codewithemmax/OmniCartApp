import { RecommendedSection } from "../lib/recommendations";
import ProductGrid from "./ProductGrid";

export default function PersonalizedSection({
  sections,
  userName,
}: {
  sections: RecommendedSection[];
  userName: string;
}) {
  if (!sections.length) return null;

  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-orange-100" />
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-lg">✨</span>
          <h2 className="text-base font-extrabold text-gray-800">
            Picked for you, {userName.split(" ")[0]}
          </h2>
        </div>
        <div className="flex-1 h-px bg-orange-100" />
      </div>

      {/* Query chips */}
      <div className="flex flex-wrap gap-2">
        {sections.map((s) => (
          <a
            key={s.query}
            href={`/?q=${encodeURIComponent(s.query)}`}
            className="px-3 py-1.5 bg-orange-50 border border-orange-200 text-orange-600 text-xs font-semibold rounded-full hover:bg-orange-500 hover:text-white transition"
          >
            🔍 {s.query}
          </a>
        ))}
      </div>

      {/* Product rows per past query */}
      {sections.map((s) => (
        <div key={s.query} className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-600 capitalize">
              Because you searched &ldquo;{s.query}&rdquo;
            </p>
            <a
              href={`/?q=${encodeURIComponent(s.query)}`}
              className="text-xs text-orange-500 font-semibold hover:underline"
            >
              See all →
            </a>
          </div>
          <ProductGrid products={s.products} />
        </div>
      ))}
    </section>
  );
}
