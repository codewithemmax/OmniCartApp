import * as cheerio from "cheerio";
import { Product, Source } from "./types";

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
];

function randomUA(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

async function scrapePage(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": randomUA(),
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5",
      "Accept-Encoding": "gzip, deflate, br",
      "Connection": "keep-alive",
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

function parseNGN(text: string): number {
  const match = text.match(/[\d,]+(?:\.\d{1,2})?/);
  if (!match) return 0;
  return parseFloat(match[0].replace(/,/g, ""));
}

async function scrapeJumia(query: string): Promise<Product[]> {
  const url = `https://www.jumia.com.ng/catalog/?q=${encodeURIComponent(query)}`;
  const html = await scrapePage(url);
  const $ = cheerio.load(html);
  const products: Product[] = [];

  $("article.prd").each((i, el) => {
    if (i >= 8) return false;
    const name = $(el).find(".name").text().trim();
    const priceText = $(el).find(".prc").text().trim();
    const image = $(el).find("img.img").attr("data-src") ?? $(el).find("img").attr("src") ?? "";
    const href = $(el).find("a.core").attr("href") ?? "";
    const ratingText = $(el).find(".stars._s").attr("style") ?? "";
    const ratingMatch = ratingText.match(/width:\s*([\d.]+)%/);
    const rating = ratingMatch ? Math.round((parseFloat(ratingMatch[1]) / 100) * 5 * 10) / 10 : 0;

    if (!name || !href) return;

    products.push({
      id: `Jumia-${i}-${Date.now()}`,
      name,
      price: parseNGN(priceText),
      image: image.startsWith("http") ? image : `https://www.jumia.com.ng${image}`,
      source: "Jumia" as Source,
      inStock: true,
      deliveryDays: 2,
      url: href.startsWith("http") ? href : `https://www.jumia.com.ng${href}`,
      rating,
      reviewCount: 0,
    });
  });

  return products;
}

async function scrapeKonga(query: string): Promise<Product[]> {
  const url = `https://www.konga.com/search?search=${encodeURIComponent(query)}`;
  const html = await scrapePage(url);
  const $ = cheerio.load(html);
  const products: Product[] = [];

  $("[class*='ProductCard']").each((i, el) => {
    if (i >= 8) return false;
    const name = $(el).find("[class*='product-title'], h3, h4").first().text().trim();
    const priceText = $(el).find("[class*='price'], [class*='Price']").first().text().trim();
    const image = $(el).find("img").first().attr("src") ?? "";
    const href = $(el).find("a").first().attr("href") ?? "";

    if (!name || !href) return;

    products.push({
      id: `Konga-${i}-${Date.now()}`,
      name,
      price: parseNGN(priceText),
      image: image.startsWith("http") ? image : `https://www.konga.com${image}`,
      source: "Konga" as Source,
      inStock: true,
      deliveryDays: 3,
      url: href.startsWith("http") ? href : `https://www.konga.com${href}`,
      rating: 0,
      reviewCount: 0,
    });
  });

  return products;
}

async function scrapeTemu(query: string): Promise<Product[]> {
  const url = `https://www.temu.com/search_result.html?search_key=${encodeURIComponent(query)}`;
  const html = await scrapePage(url);
  const $ = cheerio.load(html);
  const products: Product[] = [];

  $("[class*='goods-card'], [class*='product-card']").each((i, el) => {
    if (i >= 8) return false;
    const name = $(el).find("[class*='title'], [class*='name']").first().text().trim();
    const priceText = $(el).find("[class*='price']").first().text().trim();
    const image = $(el).find("img").first().attr("src") ?? "";
    const href = $(el).find("a").first().attr("href") ?? "";

    if (!name) return;

    const USD_TO_NGN = 1600;
    const usdPrice = parseFloat(priceText.replace(/[^0-9.]/g, "")) || 0;

    products.push({
      id: `Temu-${i}-${Date.now()}`,
      name,
      price: Math.round(usdPrice * USD_TO_NGN),
      image: image.startsWith("http") ? image : `https://www.temu.com${image}`,
      source: "Temu" as Source,
      inStock: true,
      deliveryDays: 14,
      url: href.startsWith("http") ? href : `https://www.temu.com${href}`,
      rating: 0,
      reviewCount: 0,
    });
  });

  return products;
}

export async function scrapeAllSites(query: string): Promise<Product[]> {
  const results = await Promise.allSettled([
    scrapeJumia(query),
    scrapeKonga(query),
    scrapeTemu(query),
  ]);

  const all: Product[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") all.push(...r.value);
  }
  return all;
}
