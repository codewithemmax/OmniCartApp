import { Product } from "../lib/types";
import TrustScore from "./TrustScore";

const badgeColors: Record<Product["source"], string> = {
  Amazon: "bg-yellow-500",
  Jumia: "bg-orange-500",
  Konga: "bg-purple-600",
  Temu: "bg-red-500",
};

export default function ProductCard({ product }: { product: Product }) {
  return (
    <div className="bg-white border border-orange-100 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition">
      <div className="relative">
        <img
          src={product.image}
          alt={product.name}
          className="w-full h-48 object-contain bg-orange-50"
        />
        <span
          className={`absolute top-2 left-2 ${badgeColors[product.source]} text-white text-[10px] px-2 py-1 rounded-full font-bold uppercase tracking-wide`}
        >
          {product.source}
        </span>
        {!product.inStock && (
          <span className="absolute top-2 right-2 bg-gray-400 text-white text-[10px] px-2 py-1 rounded-full font-bold uppercase">
            Out of Stock
          </span>
        )}
      </div>
      <div className="p-3">
        <h3 className="text-sm font-medium text-gray-800 truncate">{product.name}</h3>
        <p className="text-orange-600 font-bold text-lg mt-1">
          {product.price > 0 ? `₦${product.price.toLocaleString()}` : "See price on site"}
        </p>
        <TrustScore products={[product]} />
        <p className="text-xs text-gray-400 mt-1">
          Delivery: {product.deliveryDays} day{product.deliveryDays !== 1 ? "s" : ""}
        </p>
        <a
          href={product.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full mt-2 bg-orange-100 text-orange-600 py-2 rounded-lg font-semibold text-center text-sm hover:bg-orange-500 hover:text-white transition-colors"
        >
          View on {product.source}
        </a>
      </div>
    </div>
  );
}
