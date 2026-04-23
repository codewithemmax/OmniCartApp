"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, isToolUIPart, TextUIPart } from "ai";
import { useEffect, useRef, useState } from "react";
import ProductCard from "./ProductCard";
import { Product } from "../lib/types";

interface ChatProduct {
  id: string;
  name: string;
  price: string;
  source: Product["source"];
  rating: number;
  reviewCount: number;
  deliveryDays: number;
  inStock: boolean;
  url: string;
  image: string;
}

function toChatProduct(p: ChatProduct): Product {
  return {
    ...p,
    price: typeof p.price === "string" ? parseFloat(p.price.replace(/[^0-9.]/g, "")) || 0 : p.price,
  };
}

export default function ChatInterface() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });

  const isLoading = status === "streaming" || status === "submitted";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    sendMessage({ text: input });
    setInput("");
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-orange-500 hover:bg-orange-600 text-white rounded-full shadow-lg flex items-center justify-center transition"
        aria-label="Open shopping assistant"
      >
        {open ? (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 4L16 16M16 4L4 16" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
        ) : (
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Outer ring */}
            <circle cx="14" cy="14" r="12" stroke="white" strokeWidth="1.5" fill="none" opacity="0.4"/>
            {/* Left wing */}
            <path
              d="M4 14 C4 8 8 5 12 7 C10 9 10 11 12 13 C10 15 10 17 12 19 C8 21 4 18 4 14Z"
              fill="white"
              opacity="0.85"
            />
            {/* Right wing */}
            <path
              d="M24 14 C24 8 20 5 16 7 C18 9 18 11 16 13 C18 15 18 17 16 19 C20 21 24 18 24 14Z"
              fill="white"
              opacity="0.85"
            />
            {/* Center body */}
            <ellipse cx="14" cy="14" rx="3.5" ry="5.5" fill="white" />
            {/* Eyes */}
            <circle cx="12.5" cy="12.5" r="1" fill="#FF6600" />
            <circle cx="15.5" cy="12.5" r="1" fill="#FF6600" />
            {/* Mouth */}
            <path d="M12 15.5 Q14 17 16 15.5" stroke="#FF6600" strokeWidth="0.8" strokeLinecap="round" fill="none"/>
          </svg>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-[370px] max-h-[600px] flex flex-col bg-white rounded-2xl shadow-2xl border border-orange-100 overflow-hidden">
          {/* Header */}
          <div className="bg-orange-500 px-4 py-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="14" cy="14" r="12" stroke="#FF6600" strokeWidth="1.5" fill="none" opacity="0.4"/>
                <path d="M4 14 C4 8 8 5 12 7 C10 9 10 11 12 13 C10 15 10 17 12 19 C8 21 4 18 4 14Z" fill="#FF6600" opacity="0.85"/>
                <path d="M24 14 C24 8 20 5 16 7 C18 9 18 11 16 13 C18 15 18 17 16 19 C20 21 24 18 24 14Z" fill="#FF6600" opacity="0.85"/>
                <ellipse cx="14" cy="14" rx="3.5" ry="5.5" fill="#FF6600" />
                <circle cx="12.5" cy="12.5" r="1" fill="white" />
                <circle cx="15.5" cy="12.5" r="1" fill="white" />
                <path d="M12 15.5 Q14 17 16 15.5" stroke="white" strokeWidth="0.8" strokeLinecap="round" fill="none"/>
              </svg>
            </div>
            <div>
              <p className="text-white font-bold text-sm">OmniCart Shopping Expert</p>
              <p className="text-orange-100 text-xs">Powered by Gemini</p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-orange-50">
            {messages.length === 0 && (
              <div className="text-center py-8 space-y-2">
                <p className="text-3xl">🛒</p>
                <p className="text-sm font-semibold text-gray-700">
                  Hi! I&apos;m your OmniCart Shopping Expert.
                </p>
                <p className="text-xs text-gray-400">
                  Ask me to find products, compare prices, or get recommendations.
                </p>
                <div className="flex flex-wrap gap-2 justify-center mt-3">
                  {["Best phones under ₦150k", "Compare laptops", "Wireless earbuds"].map((s) => (
                    <button
                      key={s}
                      onClick={() => sendMessage({ text: s })}
                      className="text-xs bg-white border border-orange-200 text-orange-600 px-3 py-1.5 rounded-full hover:bg-orange-500 hover:text-white transition"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) => {
              const isUser = m.role === "user";

              // Extract text from text parts
              const textContent = m.parts
                .filter((p): p is TextUIPart => p.type === "text")
                .map((p) => p.text)
                .join("");

              // Extract products from tool output parts
              const products: Product[] = [];
              if (!isUser) {
                for (const part of m.parts) {
                  if (
                    isToolUIPart(part) &&
                    part.state === "output-available" &&
                    Array.isArray(part.output)
                  ) {
                    for (const item of part.output as ChatProduct[]) {
                      if (item?.id && item?.name) products.push(toChatProduct(item));
                    }
                  }
                }
              }

              return (
                <div key={m.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[90%] space-y-3 flex flex-col ${isUser ? "items-end" : "items-start"}`}>
                    {textContent && (
                      <div
                        className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                          isUser
                            ? "bg-orange-500 text-white rounded-br-sm"
                            : "bg-white text-gray-800 border border-orange-100 rounded-bl-sm shadow-sm"
                        }`}
                      >
                        {textContent}
                      </div>
                    )}

                    {!isUser && products.length > 0 && (
                      <div className="grid grid-cols-2 gap-2 w-full">
                        {products.map((p) => (
                          <ProductCard key={p.id} product={p} />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white border border-orange-100 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
                  <div className="flex gap-1 items-center">
                    <span className="w-2 h-2 bg-orange-400 rounded-full animate-bounce [animation-delay:0ms]" />
                    <span className="w-2 h-2 bg-orange-400 rounded-full animate-bounce [animation-delay:150ms]" />
                    <span className="w-2 h-2 bg-orange-400 rounded-full animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            )}

            {error && <p className="text-xs text-red-400 text-center">Something went wrong. Try again.</p>}

            <div ref={bottomRef} />
          </div>

          {/* Input form */}
          <form onSubmit={handleSubmit} className="flex gap-2 p-3 border-t border-orange-100 bg-white">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about any product…"
              disabled={isLoading}
              className="flex-1 px-3 py-2 text-sm rounded-xl border border-orange-200 focus:outline-none focus:ring-2 focus:ring-orange-300 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="px-4 py-2 bg-orange-500 text-white text-sm font-semibold rounded-xl hover:bg-orange-600 transition disabled:opacity-50"
            >
              Send
            </button>
          </form>
        </div>
      )}
    </>
  );
}
