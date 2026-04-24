import { Product } from "./types";
import { connectDB } from "./mongodb";
import ProductCache from "./models/ProductCache";
import { scrapeAllSites } from "./scraper";

const AMAZON_HOST = "real-time-amazon-data.p.rapidapi.com";
const USD_TO_NGN = 1600;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ─── Helpers ────────────────────────────────────────────────────────────────

function parsePrice(priceStr?: string | null): number {
  if (!priceStr) return 0;
  const num = parseFloat(priceStr.replace(/[^0-9.]/g, ""));
  if (isNaN(num)) return 0;
  return Math.round(num * USD_TO_NGN);
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Tier 1: MongoDB Cache ───────────────────────────────────────────────────

async function readCache(query: string): Promise<Product[] | null> {
  try {
    await connectDB();
    const doc = await ProductCache.findOne({ query: query.toLowerCase().trim() }).lean<{
      products: Product[];
      lastUpdated: Date;
    }>();
    if (!doc) return null;
    const age = Date.now() - new Date(doc.lastUpdated).getTime();
    if (age > CACHE_TTL_MS) return null; // stale
    return doc.products as Product[];
  } catch {
    return null; // cache failure is non-fatal
  }
}

async function writeCache(query: string, products: Product[]): Promise<void> {
  try {
    await connectDB();
    await ProductCache.findOneAndUpdate(
      { query: query.toLowerCase().trim() },
      { products, lastUpdated: new Date() },
      { upsert: true, returnDocument: "after" }
    );
  } catch {
    // non-fatal
  }
}

// ─── Tier 2: RapidAPI (Amazon) ───────────────────────────────────────────────

interface AmazonItem {
  asin: string;
  product_title: string;
  product_price?: string;
  product_photo?: string;
  product_url: string;
  product_star_rating?: string;
  product_num_ratings?: number;
  product_availability?: string;
}

async function fetchFromRapidAPI(query: string): Promise<Product[]> {
  const key = process.env.RAPIDAPI_KEY;
  if (!key) throw new Error("RAPIDAPI_KEY not set");

  const url = new URL(`https://${AMAZON_HOST}/search`);
  url.searchParams.set("query", query);
  url.searchParams.set("page", "1");
  url.searchParams.set("country", "US");
  url.searchParams.set("sort_by", "RELEVANCE");
  url.searchParams.set("product_condition", "ALL");

  const res = await fetch(url.toString(), {
    headers: {
      "Content-Type": "application/json",
      "x-rapidapi-key": key,
      "x-rapidapi-host": AMAZON_HOST,
    },
    cache: "no-store",
  });

  // Throw specific errors so caller can decide fallback
  if (res.status === 429 || res.status === 503) {
    throw new Error(`RATE_LIMIT:${res.status}`);
  }
  if (!res.ok) throw new Error(`HTTP_ERROR:${res.status}`);

  const data = await res.json();
  const items: AmazonItem[] = data.data?.products ?? [];

  return items.slice(0, 10).map((item) => ({
    id: `Amazon-${item.asin}`,
    name: item.product_title,
    price: parsePrice(item.product_price),
    image: item.product_photo ?? `https://placehold.co/400x300/FF9900/white?text=Amazon`,
    source: "Amazon" as const,
    inStock: !item.product_availability?.toLowerCase().includes("unavailable"),
    deliveryDays: 7,
    url: item.product_url,
    rating: parseFloat(item.product_star_rating ?? "0") || 0,
    reviewCount: item.product_num_ratings ?? 0,
  }));
}

// ─── Tier 3: Google Custom Search Fallback ───────────────────────────────────

const GOOGLE_SITES = ["jumia.com.ng", "konga.com", "temu.com"];
const DELIVERY_DAYS: Record<string, number> = {
  "jumia.com.ng": 2,
  "konga.com": 3,
  "temu.com": 14,
};
const SOURCE_MAP: Record<string, Product["source"]> = {
  "jumia.com.ng": "Jumia",
  "konga.com": "Konga",
  "temu.com": "Temu",
};

function detectSite(url: string): string {
  for (const site of GOOGLE_SITES) {
    if (url.includes(site)) return site;
  }
  return "jumia.com.ng";
}

function extractPriceFromSnippet(text: string): number {
  const match = text.match(/[₦$£€][\s]?([\d,]+(?:\.\d{1,2})?)/);
  if (match) return parseFloat(match[1].replace(/,/g, ""));
  return 0;
}

async function fetchFromGoogle(query: string): Promise<Product[]> {
  const key = process.env.GOOGLE_CSE_KEY;
  const cx = process.env.GOOGLE_CSE_ID;
  if (!key || !cx) throw new Error("Google CSE not configured");

  const results = await Promise.allSettled(
    GOOGLE_SITES.map(async (site) => {
      const url = new URL("https://www.googleapis.com/customsearch/v1");
      url.searchParams.set("key", key);
      url.searchParams.set("cx", cx);
      url.searchParams.set("q", query);
      url.searchParams.set("siteSearch", site);
      url.searchParams.set("num", "3");

      const res = await fetch(url.toString(), { cache: "no-store" });
      if (!res.ok) return [];

      const data = await res.json();
      return (data.items ?? []).map((item: {
        title: string;
        link: string;
        snippet: string;
        pagemap?: { cse_image?: { src: string }[] };
      }, i: number) => {
        const detectedSite = detectSite(item.link);
        return {
          id: `${SOURCE_MAP[detectedSite]}-google-${i}-${Date.now()}`,
          name: item.title.replace(/\s*[-|].*$/, "").trim(),
          price: extractPriceFromSnippet(item.snippet + " " + item.title),
          image:
            item.pagemap?.cse_image?.[0]?.src ??
            `https://placehold.co/400x300/FF6600/white?text=${SOURCE_MAP[detectedSite]}`,
          source: SOURCE_MAP[detectedSite],
          inStock: true,
          deliveryDays: DELIVERY_DAYS[detectedSite],
          url: item.link,
          rating: 0,
          reviewCount: 0,
        } as Product;
      });
    })
  );

  const all: Product[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") all.push(...r.value);
  }
  return all;
}

// ─── Main Hybrid Fetch ───────────────────────────────────────────────────────

export async function fetchAllProducts(query: string): Promise<Product[]> {
  if (!query.trim()) return [];

  // Tier 1 — MongoDB cache
  const cached = await readCache(query);
  if (cached?.length) {
    console.log(`[cache hit] "${query}" — ${cached.length} products`);
    return shuffle(cached);
  }

  let products: Product[] = [];
  let source = "";

  // Tier 2 — RapidAPI
  try {
    products = await fetchFromRapidAPI(query);
    source = "rapidapi";
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    const isRateLimit = msg.startsWith("RATE_LIMIT");

    if (isRateLimit) {
      // Tier 3 — Google CSE fallback
      console.warn(`[tier3] RapidAPI rate limited, trying Google CSE for "${query}"`);
      try {
        products = await fetchFromGoogle(query);
        source = "google";
      } catch {
        console.warn(`[tier3] Google CSE failed for "${query}"`);
      }
    }

    // Tier 4 — Cheerio scraper (last resort)
    if (!products.length) {
      console.warn(`[tier4] Scraping fallback for "${query}"`);
      try {
        products = await scrapeAllSites(query);
        source = "scraper";
      } catch {
        console.error(`[tier4] Scraper also failed for "${query}"`);
      }
    }
  }

  const valid = products.filter((p) => p.price > 0 || p.inStock);

  // Tier 4 — Persist to cache
  if (valid.length) {
    console.log(`[cache write] "${query}" — ${valid.length} products from ${source}`);
    await writeCache(query, valid);
  }

  return shuffle(valid);
}

// ─── Trending ────────────────────────────────────────────────────────────────

const TRENDING_CATEGORIES = [
  { label: "📱 Smartphones", query: "smartphone" },
  { label: "💻 Laptops & Computers", query: "laptop" },
  { label: "🎧 Audio & Headphones", query: "wireless earbuds" },
  { label: "📷 Cameras", query: "digital camera" },
  { label: "⌚ Smartwatches", query: "smartwatch" },
  { label: "👟 Sneakers & Shoes", query: "sneakers" },
  { label: "👗 Women's Fashion", query: "women dress" },
  { label: "👔 Men's Fashion", query: "men jacket" },
  { label: "🏠 Home & Kitchen", query: "kitchen appliances" },
  { label: "💄 Beauty & Skincare", query: "skincare" },
  { label: "🎮 Gaming", query: "gaming accessories" },
  { label: "🧸 Toys & Kids", query: "kids toys" },
];

export async function fetchTrending(): Promise<{
  hero: Product[];
  sections: { label: string; query: string; products: Product[] }[];
}> {
  const [heroResult, ...categoryResults] = await Promise.allSettled([
    fetchAllProducts("best sellers"),
    ...TRENDING_CATEGORIES.map((cat) =>
      fetchAllProducts(cat.query).then((products) => ({
        ...cat,
        products: shuffle(products).slice(0, 10),
      }))
    ),
  ]);

  const hero =
    heroResult.status === "fulfilled"
      ? shuffle(heroResult.value as Product[]).slice(0, 8)
      : [];

  const sections = categoryResults
    .filter(
      (r): r is PromiseFulfilledResult<{ label: string; query: string; products: Product[] }> =>
        r.status === "fulfilled" && r.value.products.length > 0
    )
    .map((r) => r.value);

  return { hero, sections };
}
