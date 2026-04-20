import { Bundle, BundleItem, Product } from "./types";

// Maps a search query to companion accessory queries
const BUNDLE_MAP: Record<string, string[]> = {
  iphone: ["phone case", "USB-C charger", "screen protector"],
  samsung: ["phone case", "USB-C charger", "screen protector"],
  laptop: ["laptop bag", "wireless mouse", "USB hub"],
  macbook: ["laptop sleeve", "USB-C hub", "wireless mouse"],
  ps5: ["HDMI cable", "controller charging dock", "gaming headset"],
  tv: ["HDMI cable", "TV wall mount", "universal remote"],
  camera: ["camera bag", "memory card", "tripod"],
};

function detectBundleKeyword(query: string): string | null {
  const q = query.toLowerCase();
  for (const key of Object.keys(BUNDLE_MAP)) {
    if (q.includes(key)) return key;
  }
  return null;
}

// Pick the cheapest in-stock product from a list
function cheapest(products: Product[]): Product | null {
  const inStock = products.filter((p) => p.inStock);
  if (!inStock.length) return products[0] ?? null;
  return inStock.reduce((a, b) => (a.price < b.price ? a : b));
}

export async function buildBundle(
  mainQuery: string,
  allProducts: Product[],
  fetchAll: (q: string) => Promise<Product[]>
): Promise<Bundle | null> {
  const key = detectBundleKeyword(mainQuery);
  if (!key) return null;

  const accessoryQueries = BUNDLE_MAP[key];

  // Fetch all accessories in parallel
  const accessoryResults = await Promise.allSettled(
    accessoryQueries.map((q) => fetchAll(q))
  );

  const items: BundleItem[] = [];

  // Main product — cheapest from already-fetched results
  const mainProduct = cheapest(allProducts);
  if (!mainProduct) return null;
  items.push({ role: key.charAt(0).toUpperCase() + key.slice(1), product: mainProduct });

  // Accessories
  for (let i = 0; i < accessoryResults.length; i++) {
    const r = accessoryResults[i];
    if (r.status === "fulfilled") {
      const best = cheapest(r.value);
      if (best) items.push({ role: accessoryQueries[i], product: best });
    }
  }

  const totalPrice = items.reduce((sum, item) => sum + item.product.price, 0);

  // Savings = difference between most expensive source total vs cheapest (bundle) total
  const worstPrice = items.reduce((sum, item) => {
    const worst = [...allProducts, ...items.map((i) => i.product)]
      .filter((p) => p.name === item.product.name || true)
      .reduce((a, b) => (a.price > b.price ? a : b), item.product);
    return sum + worst.price;
  }, 0);

  return { items, totalPrice, savings: Math.max(0, worstPrice - totalPrice) };
}
