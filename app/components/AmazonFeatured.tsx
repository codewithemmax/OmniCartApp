import { Product } from "../lib/types";
import TrustScore from "./TrustScore";

export default function AmazonFeatured({ products }: { products: Product[] }) {
  if (!products.length) return null;

  const [hero, ...rest] = products;

  return (
    <section className="space-y-4">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="bg-yellow-400 text-yellow-900 text-xs font-extrabold px-2 py-1 rounded-full uppercase tracking-wide">
            Amazon
          </span>
          <h2 className="text-xl font-extrabold text-gray-800">Featured on Amazon</h2>
        </div>
        <a
          href="/?q=best+sellers"
          className="text-sm text-orange-500 font-semibold hover:underline"
        >
          See all →
        </a>
      </div>

      {/* Hero card + side grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Large hero card */}
        <a
          href={hero.url}
          target="_blank"
          rel="noopener noreferrer"
          className="md:col-span-1 bg-gradient-to-br from-yellow-50 to-orange-50 border border-yellow-200 rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition group"
        >
          <div className="relative">
            <img
              src={hero.image}
              alt={hero.name}
              className="w-full h-48 sm:h-64 object-contain p-4 bg-white"
            />
            <span className="absolute top-3 left-3 bg-yellow-400 text-yellow-900 text-[10px] px-2 py-1 rounded-full font-extrabold uppercase">
              Amazon
            </span>
            {hero.reviewCount > 1000 && (
              <span className="absolute top-3 right-3 bg-orange-500 text-white text-[10px] px-2 py-1 rounded-full font-bold">
                🔥 Popular
              </span>
            )}
          </div>
          <div className="p-4">
            <h3 className="font-bold text-gray-800 text-sm line-clamp-2">{hero.name}</h3>
            <TrustScore products={[hero]} />
            <p className="text-orange-600 font-extrabold text-2xl mt-2">
              {hero.price > 0 ? `₦${hero.price.toLocaleString()}` : "See price"}
            </p>
            <span className="inline-block mt-3 w-full text-center bg-yellow-400 hover:bg-yellow-500 text-yellow-900 font-bold py-2 rounded-xl transition text-sm">
              View on Amazon →
            </span>
          </div>
        </a>

        {/* Smaller cards grid */}
        <div className="md:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-3">
          {rest.slice(0, 6).map((product) => (
            <a
              key={product.id}
              href={product.url}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white border border-yellow-100 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition group"
            >
              <div className="relative">
                <img
                  src={product.image}
                  alt={product.name}
                  className="w-full h-32 object-contain bg-gray-50 p-2"
                />
                <span className="absolute top-1.5 left-1.5 bg-yellow-400 text-yellow-900 text-[9px] px-1.5 py-0.5 rounded-full font-extrabold uppercase">
                  AMZ
                </span>
              </div>
              <div className="p-2.5">
                <p className="text-xs font-medium text-gray-700 line-clamp-2">{product.name}</p>
                <p className="text-orange-600 font-bold text-sm mt-1">
                  {product.price > 0 ? `₦${product.price.toLocaleString()}` : "See price"}
                </p>
                {product.rating > 0 && (
                  <p className="text-[10px] text-yellow-500 mt-0.5">
                    {"★".repeat(Math.round(product.rating))} {product.rating.toFixed(1)}
                  </p>
                )}
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
