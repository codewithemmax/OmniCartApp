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
- When presenting products, mention: name, price in ₦, source (Jumia/Amazon), rating, and delivery days.
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
          return products.map((p) => ({
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
          return products.slice(0, limit).map((p) => ({
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
          }));
        },
      },
    },
  });

  return result.toUIMessageStreamResponse();
}
