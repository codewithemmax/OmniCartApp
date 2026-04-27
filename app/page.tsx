import { Suspense } from "react";
import { auth } from "./lib/auth";
import { fetchAllProducts, fetchTrending, shuffle } from "./lib/fetchProducts";
import { buildBundle } from "./lib/bundleDetector";
import { logSearch } from "./lib/searchLogger";
import { getPersonalizedRecommendations } from "./lib/recommendations";
import SearchBar from "./components/SearchBar";
import Filters from "./components/Filters";
import ProductGrid from "./components/ProductGrid";
import UserMenu from "./components/UserMenu";
import BundlePanel from "./components/BundlePanel";
import TrustScore from "./components/TrustScore";
import AlertButton from "./components/AlertButton";
import AmazonFeatured from "./components/AmazonFeatured";
import PersonalizedSection from "./components/PersonalizedSection";

interface PageProps {
  searchParams: Promise<{ q?: string; maxPrice?: string; maxDays?: string }>;
}

export default async function Home({ searchParams }: PageProps) {
  const { q = "", maxPrice, maxDays } = await searchParams;

  const session = await auth();
  const isAdmin = session?.user?.email === process.env.ADMIN_EMAIL;

  const isSearch = q.trim().length > 0;

  const [searchProducts, trending, personalizedSections] = await Promise.all([
    isSearch ? fetchAllProducts(q) : Promise.resolve([]),
    isSearch ? Promise.resolve({ hero: [], sections: [], kongaTemu: [] }) : fetchTrending(),
    !isSearch && session?.user?.id
      ? getPersonalizedRecommendations(session.user.id)
      : Promise.resolve([]),
  ]);

  let products = searchProducts;
  if (maxPrice) products = products.filter((p) => p.price <= Number(maxPrice));
  if (maxDays) products = products.filter((p) => p.deliveryDays <= Number(maxDays));

  const bundle = isSearch ? await buildBundle(q, products, fetchAllProducts) : null;
  const lowestPrice = products.filter((p) => p.inStock).sort((a, b) => a.price - b.price)[0]?.price ?? 0;

  // Log search to DB
  if (isSearch) {
    await logSearch({
      userId: session?.user?.id ?? "guest",
      userName: session?.user?.name ?? "Guest",
      userEmail: session?.user?.email ?? "",
      query: q,
      resultsCount: products.length,
      maxPrice,
      maxDays,
    });
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Sticky Header */}
      <header className="sticky top-0 z-10 bg-white border-b border-orange-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2.5 sm:py-3 flex items-center gap-2 sm:gap-4">
          <span className="text-lg sm:text-2xl font-extrabold text-orange-500 shrink-0">OmniCart</span>
          <div className="flex-1 min-w-0">
            <Suspense>
              <SearchBar />
            </Suspense>
          </div>
          <UserMenu />
          {isAdmin && (
            <a
              href="/admin"
              className="shrink-0 px-2 py-1.5 sm:px-3 text-xs font-bold text-orange-600 border border-orange-300 rounded-lg hover:bg-orange-50 transition"
            >
              <span className="hidden sm:inline">📊 Admin</span>
              <span className="sm:hidden">📊</span>
            </a>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-6 sm:space-y-8">
        {!isSearch ? (
          <>
            {/* Hero */}
            <div className="text-cent er py-6 sm:py-8 space-y-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-800">
                Shop smarter on <span className="text-orange-500">Amazon, Jumia, Temu and other marketplace</span>
              </h1>
              <p className="text-gray-400 text-sm sm:text-base max-w-md mx-auto">
                Real-time prices, ratings and delivery times — all in one place.
              </p>
            </div>

            {/* Personalized recommendations — logged in users only */}
            {personalizedSections.length > 0 && (
              <PersonalizedSection
                sections={personalizedSections}
                userName={session?.user?.name ?? "there"}
              />
            )}

            {/* Amazon featured hero */}
            <AmazonFeatured products={trending.hero} />

            {/* Category sections — Amazon + Jumia interleaved */}
            {trending.sections.map((section, i) => (
              <section key={section.query}>
                {i > 0 && i % 4 === 0 && (
                  <div className="mb-6 rounded-2xl bg-gradient-to-r from-orange-500 to-yellow-400 p-5 flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <p className="text-white font-extrabold text-lg">Top Deals Across Platforms</p>
                      <p className="text-orange-100 text-sm">Amazon · Jumia · Konga · Temu — updated daily</p>
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                      {["Amazon","Jumia","Konga","Temu"].map((s) => (
                        <span key={s} className="bg-white/20 text-white text-xs font-bold px-2.5 py-1 rounded-full">{s}</span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-bold text-gray-800">{section.label}</h2>
                    <a href={`/?q=${encodeURIComponent(section.query)}`} className="text-sm text-orange-500 font-semibold hover:underline shrink-0">See all →</a>
                  </div>
                  <ProductGrid products={section.products} />
                </div>
              </section>
            ))}

            {/* Konga sections */}
            {trending.kongaTemu.filter((s) => s.source === "Konga").length > 0 && (
              <>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-purple-100" />
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="bg-purple-600 text-white text-xs font-extrabold px-3 py-1 rounded-full">Konga</span>
                    <span className="text-sm font-bold text-gray-700">Deals on Konga</span>
                  </div>
                  <div className="flex-1 h-px bg-purple-100" />
                </div>
                {trending.kongaTemu.filter((s) => s.source === "Konga").map((section) => (
                  <section key={`konga-${section.query}`} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h2 className="text-base font-bold text-gray-700">{section.label}</h2>
                      <a href={`/?q=${encodeURIComponent(section.query)}`} className="text-sm text-purple-500 font-semibold hover:underline shrink-0">See all →</a>
                    </div>
                    <ProductGrid products={section.products} />
                  </section>
                ))}
              </>
            )}

            {/* Temu sections */}
            {trending.kongaTemu.filter((s) => s.source === "Temu").length > 0 && (
              <>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-red-100" />
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="bg-red-500 text-white text-xs font-extrabold px-3 py-1 rounded-full">Temu</span>
                    <span className="text-sm font-bold text-gray-700">Deals on Temu</span>
                  </div>
                  <div className="flex-1 h-px bg-red-100" />
                </div>
                {trending.kongaTemu.filter((s) => s.source === "Temu").map((section) => (
                  <section key={`temu-${section.query}`} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h2 className="text-base font-bold text-gray-700">{section.label}</h2>
                      <a href={`/?q=${encodeURIComponent(section.query)}`} className="text-sm text-red-500 font-semibold hover:underline shrink-0">See all →</a>
                    </div>
                    <ProductGrid products={section.products} />
                  </section>
                ))}
              </>
            )}
          </>
        ) : (
          <>
            {/* Filters + Alert row */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Suspense>
                <Filters />
              </Suspense>
              <AlertButton query={q} lowestPrice={lowestPrice} />
            </div>

            {/* Unified trust score */}
            {products.length > 0 && (
              <div className="flex items-center gap-2 px-1">
                <span className="text-sm text-gray-500 font-medium">Unified Trust Score:</span>
                <TrustScore products={products} />
              </div>
            )}

            {/* Bundle panel */}
            {bundle && <BundlePanel bundle={bundle} />}

            {/* Results */}
            {products.length === 0 ? (
              <p className="text-center text-gray-400 py-20">
                No results found for &ldquo;{q}&rdquo; with the selected filters.
              </p>
            ) : (
              <>
                <p className="text-sm text-gray-500">
                  {products.length} result{products.length !== 1 ? "s" : ""} for{" "}
                  <span className="font-semibold text-gray-700">&ldquo;{q}&rdquo;</span>
                </p>
                <ProductGrid products={products} />
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
