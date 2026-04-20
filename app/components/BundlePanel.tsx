import { Bundle } from "../lib/types";

const badgeColors: Record<string, string> = {
  Jumia: "bg-orange-500",
  Konga: "bg-purple-600",
  Temu: "bg-red-500",
};

export default function BundlePanel({ bundle }: { bundle: Bundle }) {
  return (
    <div className="bg-gradient-to-r from-orange-50 to-orange-100 border border-orange-200 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h2 className="text-base font-bold text-gray-800">🛍️ Smart Bundle</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Cheapest combination across all platforms
          </p>
        </div>
        <div className="text-right">
          <p className="text-xl font-extrabold text-orange-600">
            ₦{bundle.totalPrice.toLocaleString()}
          </p>
          {bundle.savings > 0 && (
            <p className="text-xs text-green-600 font-semibold">
              Save ₦{bundle.savings.toLocaleString()} vs buying from one store
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {bundle.items.map((item) => (
          <a
            key={item.role}
            href={item.product.url}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white rounded-xl p-3 shadow-sm hover:shadow-md transition group"
          >
            <img
              src={item.product.image}
              alt={item.product.name}
              className="w-full h-28 object-contain mb-2"
            />
            <p className="text-[10px] font-bold uppercase text-gray-400 tracking-wide">
              {item.role}
            </p>
            <p className="text-xs font-medium text-gray-700 truncate mt-0.5">
              {item.product.name}
            </p>
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-orange-600 font-bold text-sm">
                ₦{item.product.price.toLocaleString()}
              </span>
              <span
                className={`text-[9px] text-white px-1.5 py-0.5 rounded-full font-bold ${badgeColors[item.product.source] ?? "bg-gray-400"}`}
              >
                {item.product.source}
              </span>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
