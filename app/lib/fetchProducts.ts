import { Product } from "./types";

const JUMIA_HOST = "jumia-e-commerce-data-api.p.rapidapi.com";
const AMAZON_HOST = "real-time-amazon-data.p.rapidapi.com";
const USD_TO_NGN = 1600;

function parsePrice(priceStr?: string | null, currency = "NGN"): number {
  if (!priceStr) return 0;
  const num = parseFloat(priceStr.replace(/[^0-9.]/g, ""));
  if (isNaN(num)) return 0;
  return currency === "USD" ? Math.round(num * USD_TO_NGN) : num;
}

async function rapidFetch(url: string, host: string): Promise<Response> {
  const key = process.env.RAPIDAPI_KEY!;
  return fetch(url, {
    headers: {
      "Content-Type": "application/json",
      "x-rapidapi-key": key,
      "x-rapidapi-host": host,
    },
    cache: "no-store",
  });
}

async function fetchJumia(query: string): Promise<Product[]> {
  const res = await rapidFetch(
    `https://${JUMIA_HOST}/produit?query=${encodeURIComponent(query)}`,
    JUMIA_HOST
  );
  if (!res.ok) return [];
  const data = await res.json();
  const items = Array.isArray(data) ? data : [];
  return items.slice(0, 10).map((item: {
    id: string; title: string; price?: string;
    image?: string; url: string; rating?: number; reviews?: number;
  }) => ({
    id: `Jumia-${item.id}`,
    name: item.title,
    price: parsePrice(item.price),
    image: item.image ?? `https://placehold.co/400x300/FF6600/white?text=Jumia`,
    source: "Jumia" as const,
    inStock: true,
    deliveryDays: 2,
    url: item.url,
    rating: item.rating ?? 0,
    reviewCount: item.reviews ?? 0,
  }));
}

async function fetchAmazon(query: string): Promise<Product[]> {
  const res = await rapidFetch(
    `https://${AMAZON_HOST}/search?query=${encodeURIComponent(query)}&page=1&country=US&sort_by=RELEVANCE&product_condition=ALL`,
    AMAZON_HOST
  );
  if (!res.ok) return [];
  const data = await res.json();
  const items = data.data?.products ?? [];
  return items.slice(0, 10).map((item: {
    asin: string; product_title: string; product_price?: string;
    currency?: string; product_photo?: string; product_url: string;
    product_star_rating?: string; product_num_ratings?: number; product_availability?: string;
  }) => ({
    id: `Amazon-${item.asin}`,
    name: item.product_title,
    price: parsePrice(item.product_price, item.currency === "USD" ? "USD" : "NGN"),
    image: item.product_photo ?? `https://placehold.co/400x300/FF9900/white?text=Amazon`,
    source: "Amazon" as const,
    inStock: !item.product_availability?.toLowerCase().includes("unavailable"),
    deliveryDays: 7,
    url: item.product_url,
    rating: parseFloat(item.product_star_rating ?? "0") || 0,
    reviewCount: item.product_num_ratings ?? 0,
  }));
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export async function fetchAllProducts(query: string): Promise<Product[]> {
  if (!query.trim()) return [];
  const key = process.env.RAPIDAPI_KEY;
  if (!key) return [];

  const [jumiaResult, amazonResult] = await Promise.allSettled([
    fetchJumia(query),
    fetchAmazon(query),
  ]);

  const all: Product[] = [];
  for (const r of [jumiaResult, amazonResult]) {
    if (r.status === "fulfilled") all.push(...r.value);
  }

  // Amazon first, then shuffle within each source group so order varies per search
  const amazon = shuffle(all.filter((p) => p.source === "Amazon"));
  const jumia = shuffle(all.filter((p) => p.source !== "Amazon"));

  return [...amazon, ...jumia].filter((p) => p.price > 0 || p.inStock);
}

const TRENDING_CATEGORIES = [
  { label: "📱 Phones", query: "smartphone" },
  { label: "👟 Fashion", query: "sneakers" },
  { label: "🏠 Home & Kitchen", query: "kitchen appliances" },
  { label: "💻 Laptops", query: "laptop" },
  { label: "🎧 Audio", query: "wireless earbuds" },
];

export async function fetchTrending(): Promise<{
  amazon: Product[];
  jumia: { label: string; query: string; products: Product[] }[];
}> {
  const key = process.env.RAPIDAPI_KEY;
  if (!key) return { amazon: [], jumia: [] };

  const [amazonResult, ...jumiaResults] = await Promise.allSettled([
    fetchAmazon("best sellers"),
    ...TRENDING_CATEGORIES.map((cat) =>
      fetchJumia(cat.query).then((products) => ({ ...cat, products: products.slice(0, 6) }))
    ),
  ]);

  const amazon =
    amazonResult.status === "fulfilled"
      ? shuffle(amazonResult.value as Product[]).slice(0, 8)
      : [];

  const jumia = jumiaResults
    .filter(
      (r): r is PromiseFulfilledResult<{ label: string; query: string; products: Product[] }> =>
        r.status === "fulfilled" &&
        (r.value as { products: Product[] }).products.length > 0
    )
    .map((r) => {
      const section = r.value as { label: string; query: string; products: Product[] };
      return { ...section, products: shuffle(section.products).slice(0, 6) };
    });

  return { amazon, jumia };
}
