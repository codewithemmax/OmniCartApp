import { Product } from "./types";
import { connectDB } from "./mongodb";
import ProductCache from "./models/ProductCache";
import { scrapeAllSites } from "./scraper";

const AMAZON_HOST = "real-time-amazon-data.p.rapidapi.com";
const USD_TO_NGN = 1600;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

const CONCURRENCY = 2;
const CALL_GAP_MS = 300;
let activeRapidCalls = 0;
let lastRapidCallTime = 0;

async function rapidAPIQueue<T>(fn: () => Promise<T>): Promise<T> {
  while (activeRapidCalls >= CONCURRENCY) {
    await new Promise((r) => setTimeout(r, 50));
  }
  const gap = Date.now() - lastRapidCallTime;
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

// ─── MongoDB Cache ────────────────────────────────────────────────────────────

async function readCache(cacheKey: string): Promise<Product[] | null> {
  try {
    await connectDB();
    const doc = await ProductCache.findOne({
      query: cacheKey.toLowerCase().trim(),
    }).lean<{ products: Product[]; lastUpdated: Date }>();
    if (!doc) return null;
    if (Date.now() - new Date(doc.lastUpdated).getTime() > CACHE_TTL_MS) return null;
    const products = doc.products as Product[];
    return products.length ? products : null;
  } catch {
    return null;
  }
}

async function writeCache(cacheKey: string, products: Product[]): Promise<void> {
  try {
    await connectDB();
    await ProductCache.findOneAndUpdate(
      { query: cacheKey.toLowerCase().trim() },
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

// ─── Serper.dev Shopping Search ───────────────────────────────────────────────

const SERPER_SITE_MAP: Record<string, { source: Product["source"]; deliveryDays: number }> = {
  "jumia.com.ng": { source: "Jumia", deliveryDays: 2 },
  "konga.com":    { source: "Konga", deliveryDays: 3 },
  "temu.com":     { source: "Temu",  deliveryDays: 14 },
};

function detectSerperSource(link: string): { source: Product["source"]; deliveryDays: number } {
  for (const [domain, meta] of Object.entries(SERPER_SITE_MAP)) {
    if (link.includes(domain)) return meta;
  }
  return { source: "Jumia", deliveryDays: 2 };
}

async function fetchFromSerper(query: string): Promise<Product[]> {
  const key = process.env.SERPER_API_KEY;
  if (!key) throw new Error("SERPER_API_KEY not set");

  const res = await fetch("https://google.serper.dev/shopping", {
    method: "POST",
    headers: { "X-API-KEY": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      q: `${query} site:jumia.com.ng OR site:konga.com OR site:temu.com`,
      num: 20,
      gl: "ng",
      hl: "en",
    }),
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`Serper HTTP ${res.status}`);

  const data = await res.json();
  const items: Array<{
    title: string;
    link: string;
    price?: string;
    imageUrl?: string;
    rating?: number;
    ratingCount?: number;
  }> = data.shopping ?? [];

  return items.map((item, i) => {
    const { source, deliveryDays } = detectSerperSource(item.link ?? "");
    const rawPrice = item.price ?? "";
    const isUSD = rawPrice.startsWith("$");
    const numericPrice = parseFloat(rawPrice.replace(/[^0-9.]/g, "")) || 0;
    const price = isUSD ? Math.round(numericPrice * USD_TO_NGN) : numericPrice;
    return {
      id: `${source}-serper-${i}-${Date.now()}`,
      name: item.title,
      price,
      image: item.imageUrl ?? `https://placehold.co/400x300/FF6600/white?text=${source}`,
      source,
      inStock: true,
      deliveryDays,
      url: item.link,
      rating: item.rating ?? 0,
      reviewCount: item.ratingCount ?? 0,
    } as Product;
  }).filter((p) => p.price > 0);
}

// ─── Serper by source — cached separately ────────────────────────────────────
// Used for dedicated Konga/Temu sections on the homepage

export async function fetchSerperBySource(
  query: string,
  source: "Konga" | "Temu" | "Jumia"
): Promise<Product[]> {
  const cacheKey = `serper:${source.toLowerCase()}:${query}`;

  const cached = await readCache(cacheKey);
  if (cached?.length) {
    console.log(`[cache hit] ${cacheKey} — ${cached.length} products`);
    return shuffle(cached);
  }

  try {
    const all = await fetchFromSerper(query);
    const filtered = all.filter((p) => p.source === source).slice(0, 10);
    if (filtered.length) {
      await writeCache(cacheKey, filtered);
      console.log(`[cache write] ${cacheKey} — ${filtered.length} products`);
    }
    return shuffle(filtered);
  } catch (err) {
    console.warn(`[serper] Failed for ${source} "${query}": ${err}`);
    return [];
  }
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

  let amazonProducts: Product[] = [];
  let jumiaProducts: Product[] = [];
  let kongaProducts: Product[] = [];
  let temuProducts: Product[] = [];

  // Tier 2 — Amazon (RapidAPI) + scraper in parallel
  const [amazonResult, scraperResult] = await Promise.allSettled([
    fetchAmazon(query),
    scrapeAllSites(query),
  ]);

  if (amazonResult.status === "fulfilled") {
    amazonProducts = amazonResult.value;
  } else {
    console.warn(`[tier2] Amazon failed for "${query}": ${amazonResult.reason}`);
  }

  if (scraperResult.status === "fulfilled") {
    jumiaProducts = scraperResult.value.filter((p) => p.source === "Jumia").slice(0, 3);
    kongaProducts = scraperResult.value.filter((p) => p.source === "Konga").slice(0, 3);
    temuProducts  = scraperResult.value.filter((p) => p.source === "Temu").slice(0, 3);
  }

  // Tier 3 — Serper if everything empty
  const hasAny = amazonProducts.length || jumiaProducts.length || kongaProducts.length || temuProducts.length;
  if (!hasAny) {
    console.warn(`[tier3] Trying Serper.dev for "${query}"`);
    try {
      const serperProducts = await fetchFromSerper(query);
      amazonProducts = serperProducts.filter((p) => p.source === "Amazon").slice(0, 3);
      jumiaProducts  = serperProducts.filter((p) => p.source === "Jumia").slice(0, 3);
      kongaProducts  = serperProducts.filter((p) => p.source === "Konga").slice(0, 3);
      temuProducts   = serperProducts.filter((p) => p.source === "Temu").slice(0, 3);
    } catch {
      console.warn(`[tier3] Serper failed for "${query}"`);
    }
  }

  // Tier 4 — full scraper last resort
  const stillEmpty = !amazonProducts.length && !jumiaProducts.length && !kongaProducts.length && !temuProducts.length;
  if (stillEmpty) {
    console.warn(`[tier4] Scraper fallback for "${query}"`);
    try {
      const scraped = await scrapeAllSites(query);
      jumiaProducts = scraped.filter((p) => p.source === "Jumia").slice(0, 3);
      kongaProducts = scraped.filter((p) => p.source === "Konga").slice(0, 3);
      temuProducts  = scraped.filter((p) => p.source === "Temu").slice(0, 3);
    } catch {
      console.error(`[tier4] Scraper failed for "${query}"`);
    }
  }

  // Interleave Amazon → Jumia → Konga → Temu
  const buckets = [amazonProducts, jumiaProducts, kongaProducts, temuProducts];
  const maxLen = Math.max(...buckets.map((b) => b.length), 0);
  const interleaved: Product[] = [];
  for (let i = 0; i < maxLen; i++) {
    for (const bucket of buckets) {
      if (bucket[i]) interleaved.push(bucket[i]);
    }
  }

  const valid = interleaved.filter((p) => p.price > 0 || p.inStock);

  if (valid.length) {
    const counts = ["Amazon", "Jumia", "Konga", "Temu"]
      .map((s) => `${valid.filter((p) => p.source === s).length} ${s}`)
      .join(" + ");
    console.log(`[cache write] "${query}" — ${counts}`);
    await writeCache(query, valid);
  }

  return shuffle(valid);
}

// ─── Trending ─────────────────────────────────────────────────────────────────

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

// Konga and Temu use dedicated Serper queries for their homepage sections
const KONGA_TEMU_CATEGORIES = [
  { label: "📱 Phones on Konga", query: "smartphone", source: "Konga" as const },
  { label: "💻 Laptops on Konga", query: "laptop", source: "Konga" as const },
  { label: "🏠 Home on Konga", query: "home appliances", source: "Konga" as const },
  { label: "📱 Phones on Temu", query: "smartphone", source: "Temu" as const },
  { label: "👗 Fashion on Temu", query: "fashion clothing", source: "Temu" as const },
  { label: "🎮 Gaming on Temu", query: "gaming accessories", source: "Temu" as const },
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

export interface TrendingResult {
  hero: Product[];
  sections: { label: string; query: string; products: Product[] }[];
  kongaTemu: { label: string; query: string; source: "Konga" | "Temu"; products: Product[] }[];
}

export async function fetchTrending(): Promise<TrendingResult> {
  // Hero + main categories + Konga/Temu sections all in batches
  const heroProducts = await fetchAllProducts("best sellers").catch(() => []);

  const mainTasks = TRENDING_CATEGORIES.map(
    (cat) => () =>
      fetchAllProducts(cat.query).then((products) => ({
        ...cat,
        products: shuffle(products).slice(0, 10),
      }))
  );

  const kongaTemuTasks = KONGA_TEMU_CATEGORIES.map(
    (cat) => () =>
      fetchSerperBySource(cat.query, cat.source).then((products) => ({
        ...cat,
        products: shuffle(products).slice(0, 8),
      }))
  );

  const [mainResults, kongaTemuResults] = await Promise.all([
    fetchInBatches(mainTasks, BATCH_SIZE, BATCH_DELAY_MS),
    fetchInBatches(kongaTemuTasks, BATCH_SIZE, BATCH_DELAY_MS),
  ]);

  const hero = shuffle(heroProducts).slice(0, 8);

  const sections = mainResults
    .filter(
      (r): r is PromiseFulfilledResult<{ label: string; query: string; products: Product[] }> =>
        r.status === "fulfilled" && r.value.products.length > 0
    )
    .map((r) => r.value);

  const kongaTemu = kongaTemuResults
    .filter(
      (r): r is PromiseFulfilledResult<{
        label: string; query: string;
        source: "Konga" | "Temu"; products: Product[];
      }> => r.status === "fulfilled" && r.value.products.length > 0
    )
    .map((r) => r.value);

  return { hero, sections, kongaTemu };
}
