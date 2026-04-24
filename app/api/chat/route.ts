import { google } from "@ai-sdk/google";
import { streamText, convertToModelMessages } from "ai";
import { z } from "zod";
import { fetchAllProducts } from "@/app/lib/fetchProducts";
import { getShoppingContext } from "@/app/lib/vectorSearch";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `You are the OmniCart Shopping Expert. Your only purpose is to help users find products and provide shopping advice on the OmniCart platform.

Rules:
- ONLY answer shopping-related questions: products, prices, comparisons, recommendations, availability, delivery.
- If asked about ANYTHING unrelated to shopping, respond: "I'm here specifically to help you find products and shopping advice. What are you looking to buy today?"
- Always call search_live_api when a user mentions a product or asks for recommendations.
- Always call get_shopping_context when you need to rank or compare products semantically.
- After showing products, ALWAYS write a short explanation for each one. Use this format:
  • [Product Name] — [1 sentence: why it suits the user's need, what makes it stand out, or a key trade-off]
- Example: • Samsung Galaxy A55 — Best mid-range pick with a 50MP camera and 5000mAh battery, ideal if you want flagship features without the flagship price.
- End with a 1-line buying tip or comparison summary.
- Be concise, friendly, and focused. Never make up product data.
- If no products are found, ask the user to refine their search.`;

export async function POST(req: Request) {
  const { messages } = await req.json();

  const modelMessages = await convertToModelMessages(messages);

  const result = streamText({
    model: google("gemini-2.5-flash"),
    system: SYSTEM_PROMPT,
    messages: modelMessages,
    tools: {
      get_shopping_context: {
        description: "Search and rank products semantically. Use this to find relevant products based on user needs.",
        inputSchema: z.object({
          query: z.string().describe("What the user is looking for"),
          limit: z.number().int().min(1).max(6).default(4),
        }),
        execute: async ({ query, limit }: { query: string; limit: number }) => {
          const products = await getShoppingContext(query, limit);
          return products.map((p, i) => ({
            id: p.id,
            name: p.name,
            price: p.price > 0 ? `₦${p.price.toLocaleString()}` : "See site",
            source: p.source,
            rating: p.rating,
            reviewCount: p.reviewCount,
            deliveryDays: p.deliveryDays,
            inStock: p.inStock,
            url: p.url,
            image: p.image,
            role: i === 0 ? "Best Match" : i === 1 ? "Runner Up" : `Option ${i + 1}`,
          }));
        },
      },
      search_live_api: {
        description: "Fetch real-time product listings from Jumia and Amazon for current prices and availability.",
        inputSchema: z.object({
          query: z.string().describe("Product search query"),
          limit: z.number().int().min(1).max(6).default(4),
        }),
        execute: async ({ query, limit }: { query: string; limit: number }) => {
          const products = await fetchAllProducts(query);
          return products.slice(0, limit).map((p, i) => ({
            id: p.id,
            name: p.name,
            price: p.price > 0 ? `₦${p.price.toLocaleString()}` : "See site",
            source: p.source,
            rating: p.rating,
            reviewCount: p.reviewCount,
            deliveryDays: p.deliveryDays,
            inStock: p.inStock,
            url: p.url,
            image: p.image,
            role: i === 0 ? "🏆 Top Pick" : i === 1 ? "💰 Best Value" : i === 2 ? "⚡ Fast Delivery" : `Option ${i + 1}`,
          }));
        },
      },
    },
  });

  return result.toUIMessageStreamResponse();
}
