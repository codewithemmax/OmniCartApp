import { Product } from "./types";
import { connectDB } from "./mongodb";
import ProductCache from "./models/ProductCache";
import { scrapeAllSites } from "./scraper";

const AMAZON_HOST = "real-time-amazon-data.p.rapidapi.com";
const USD_TO_NGN = 1600;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

// ─── RapidAPI Rate Limiter ────────────────────────────────────────────────────
// Limits concurrent RapidAPI calls to 2 with a 300ms gap between each
// so 13 trending calls don't all fire at once and burn quota

const CONCURRENCY = 2;
const CALL_GAP_MS = 300;

let activeRapidCalls = 0;
let lastRapidCallTime = 0;

async function rapidAPIQueue<T>(fn: () => Promise<T>): Promise<T> {
  // Wait until a slot is free
  while (activeRapidCalls >= CONCURRENCY) {
    await new Promise((r) => setTimeout(r, 50));
  }
  // Enforce minimum gap between calls
  const now = Date.now();
  const gap = now - lastRapidCallTime;
  if (gap < CALL_GAP_MS) {
    await new Promise((r) => setTimeout(r, CALL_GAP_MS - gap));
  }
  activeRapidCalls++;
  lastRapidCallTime = Date.now();
  try {
    return await fn();
  } finally {
    activeRapidCalls--;
  }
}

// ─── Tier 1: MongoDB Cache ────────────────────────────────────────────────────

async function readCache(query: string): Promise<Product[] | null> {
  try {
    await connectDB();
    const doc = await ProductCache.findOne({
      query: query.toLowerCase().trim(),
    }).lean<{ products: Product[]; lastUpdated: Date }>();
    if (!doc) return null;
    if (Date.now() - new Date(doc.lastUpdated).getTime() > CACHE_TTL_MS) return null;
    const products = doc.products as Product[];
    // Discard cache that has no Amazon products (stale from old integration)
    if (!products.some((p) => p.source === "Amazon")) return null;
    return products;
  } catch {
    return null;
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

// ─── Tier 2a: RapidAPI — Amazon ───────────────────────────────────────────────

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

async function fetchAmazon(query: string): Promise<Product[]> {
  const key = process.env.RAPIDAPI_KEY;
  if (!key) throw new Error("RAPIDAPI_KEY not set");

  return rapidAPIQueue(async () => {
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

    if (res.status === 429 || res.status === 503) throw new Error(`RATE_LIMIT:${res.status}`);
    if (!res.ok) throw new Error(`HTTP_ERROR:${res.status}`);

    const data = await res.json();
    const items: AmazonItem[] = data.data?.products ?? [];

    return items.slice(0, 5).map((item) => ({
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
  });
}

// ─── Tier 2b: Jumia Scraper (always runs alongside Amazon) ───────────────────

async function fetchJumia(query: string): Promise<Product[]> {
  try {
    const all = await scrapeAllSites(query);
    // scrapeAllSites returns Jumia + Konga + Temu — keep only Jumia here
    return all.filter((p) => p.source === "Jumia").slice(0, 5);
  } catch {
    return [];
  }
}

// ─── Tier 3: Google CSE Fallback ─────────────────────────────────────────────

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

function detectSite(link: string): string {
  for (const site of GOOGLE_SITES) {
    if (link.includes(site)) return site;
  }
  return "jumia.com.ng";
}

function extractPriceFromSnippet(text: string): number {
  const match = text.match(/[₦$£€][\s]?([\d,]+(?:\.\d{1,2})?)/);
  return match ? parseFloat(match[1].replace(/,/g, "")) : 0;
}

async function fetchFromGoogle(query: string): Promise<Product[]> {
  const key = process.env.GOOGLE_CSE_KEY;
  const cx = process.env.GOOGLE_CSE_ID;
  if (!key || !cx) throw new Error("Google CSE not configured");

  const url = new URL("https://www.googleapis.com/customsearch/v1");
  url.searchParams.set("key", key);
  url.searchParams.set("cx", cx);
  url.searchParams.set("q", `${query} (${GOOGLE_SITES.map((s) => `site:${s}`).join(" OR ")})`);
  url.searchParams.set("num", "10");

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) return [];

  const data = await res.json();
  return (data.items ?? []).map((item: {
    title: string; link: string; snippet: string;
    pagemap?: { cse_image?: { src: string }[] };
  }, i: number) => {
    const site = detectSite(item.link);
    return {
      id: `${SOURCE_MAP[site]}-google-${i}-${Date.now()}`,
      name: item.title.replace(/\s*[-|].*$/, "").trim(),
      price: extractPriceFromSnippet(item.snippet + " " + item.title),
      image: item.pagemap?.cse_image?.[0]?.src ??
        `https://placehold.co/400x300/FF6600/white?text=${SOURCE_MAP[site]}`,
      source: SOURCE_MAP[site],
      inStock: true,
      deliveryDays: DELIVERY_DAYS[site],
      url: item.link,
      rating: 0,
      reviewCount: 0,
    } as Product;
  });
}

// ─── Main Hybrid Fetch ────────────────────────────────────────────────────────

export async function fetchAllProducts(query: string): Promise<Product[]> {
  if (!query.trim()) return [];

  // Tier 1 — cache
  const cached = await readCache(query);
  if (cached?.length) {
    console.log(`[cache hit] "${query}" — ${cached.length} products`);
    return shuffle(cached);
  }

  // Tier 2 — fetch Amazon + Jumia in parallel
  let amazonProducts: Product[] = [];
  let jumiaProducts: Product[] = [];
  let rateLimited = false;

  const [amazonResult, jumiaResult] = await Promise.allSettled([
    fetchAmazon(query),
    fetchJumia(query),
  ]);

  if (amazonResult.status === "fulfilled") {
    amazonProducts = amazonResult.value;
  } else {
    const msg = amazonResult.reason instanceof Error ? amazonResult.reason.message : "";
    rateLimited = msg.startsWith("RATE_LIMIT");
    console.warn(`[tier2] Amazon failed for "${query}": ${msg}`);
  }

  if (jumiaResult.status === "fulfilled") {
    jumiaProducts = jumiaResult.value;
  }

  // Tier 3 — Google CSE if Amazon was rate-limited and we have no results
  if (rateLimited && !amazonProducts.length) {
    console.warn(`[tier3] Trying Google CSE for "${query}"`);
    try {
      const googleProducts = await fetchFromGoogle(query);
      // Split Google results by source
      amazonProducts = googleProducts.filter((p) => p.source === "Amazon");
      jumiaProducts = [...jumiaProducts, ...googleProducts.filter((p) => p.source !== "Amazon")];
    } catch {
      console.warn(`[tier3] Google CSE failed for "${query}"`);
    }
  }

  // Tier 4 — full scraper if still nothing
  if (!amazonProducts.length && !jumiaProducts.length) {
    console.warn(`[tier4] Full scraper fallback for "${query}"`);
    try {
      const scraped = await scrapeAllSites(query);
      jumiaProducts = scraped.filter((p) => p.source === "Jumia").slice(0, 5);
    } catch {
      console.error(`[tier4] Scraper failed for "${query}"`);
    }
  }

  // Interleave: equal Amazon + Jumia, alternating A-J-A-J...
  const maxLen = Math.max(amazonProducts.length, jumiaProducts.length);
  const interleaved: Product[] = [];
  for (let i = 0; i < maxLen; i++) {
    if (amazonProducts[i]) interleaved.push(amazonProducts[i]);
    if (jumiaProducts[i]) interleaved.push(jumiaProducts[i]);
  }

  const valid = interleaved.filter((p) => p.price > 0 || p.inStock);

  if (valid.length) {
    const aCount = valid.filter((p) => p.source === "Amazon").length;
    const jCount = valid.filter((p) => p.source === "Jumia").length;
    console.log(`[cache write] "${query}" — ${aCount} Amazon + ${jCount} Jumia`);
    await writeCache(query, valid);
  }

  return shuffle(valid);
}

// ─── Trending ─────────────────────────────────────────────────────────────────
// Stagger category fetches in batches of 3 to avoid hammering RapidAPI

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

const BATCH_SIZE = 3;
const BATCH_DELAY_MS = 500;

async function fetchInBatches<T>(
  tasks: (() => Promise<T>)[],
  batchSize: number,
  delayMs: number
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = [];
  for (let i = 0; i < tasks.length; i += batchSize) {
    const batch = tasks.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(batch.map((t) => t()));
    results.push(...batchResults);
    if (i + batchSize < tasks.length) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  return results;
}

export async function fetchTrending(): Promise<{
  hero: Product[];
  sections: { label: string; query: string; products: Product[] }[];
}> {
  // Hero fetched first, then categories in batches
  const heroProducts = await fetchAllProducts("best sellers").catch(() => []);

  const categoryTasks = TRENDING_CATEGORIES.map(
    (cat) => () =>
      fetchAllProducts(cat.query).then((products) => ({
        ...cat,
        products: shuffle(products).slice(0, 10),
      }))
  );

  const categoryResults = await fetchInBatches(categoryTasks, BATCH_SIZE, BATCH_DELAY_MS);

  const hero = shuffle(heroProducts).slice(0, 8);

  const sections = categoryResults
    .filter(
      (r): r is PromiseFulfilledResult<{ label: string; query: string; products: Product[] }> =>
        r.status === "fulfilled" && r.value.products.length > 0
    )
    .map((r) => r.value);

  return { hero, sections };
}
