Project Vision: "OmniCart" (Unified E-commerce Hub)
Objective: Build a Next.js 15 application that aggregates product listings from Jumia, Konga, and Temu into a single, cohesive interface.

Visual & UI Requirements (The "Medium" Balance) Theme: Primary color #FF6600 (Vibrant Orange), Secondary color #FFB380 (Light Orange/Peach), and #FFFFFF (Clean White) for background space.

Layout Style: Use a Tabular Grid (2 columns on mobile, 4-5 on desktop). Use rounded corners (border-radius: 12px) and soft shadows to mimic the friendly "retail" feel of Temu.

Source Badging: Every product card must have a small, distinct badge in the corner (e.g., a tiny Jumia or Konga logo) so the user knows the source at a glance without cluttering the UI.

UX Strategy (The "Simple" Experience) Global Search Bar: A large, sticky search bar at the top. When a user types "iPhone 15," the app triggers simultaneous requests to all three platforms.

Smart Fallback Logic: * If Jumia has the item: Show it first.

If Jumia is out of stock: Automatically promote the Konga or Temu listing to the top slot.

Unified Filters: Users should be able to filter by price or delivery speed across all apps at once, rather than filtering store-by-store.

Technical Stack (Next.js Implementation) Framework: Next.js (App Router).

Data Fetching: Use Promise.allSettled in a Server Component to fetch from Jumia, Konga, and Temu APIs (or edge-function scrapers) in parallel. This ensures the page loads as fast as the slowest source.

State Management: Use URL Query Parameters for search and filters. This makes the "Back" button work perfectly for users—a key UX feature in apps like Jumia.

UI Component Example (Tailwind CSS)
To get your theme started in Next.js, you can use this structure for your product cards:

TypeScript
// Example Product Card Component
const ProductCard = ({ product }) => {
return (
<div className="bg-white border border-orange-100 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition">
<div className="relative">
<img src={product.image} alt={product.name} className="w-full h-48 object-contain" />
{/* Source Badge */}
<span className="absolute top-2 left-2 bg-orange-500 text-white text-[10px] px-2 py-1 rounded-full font-bold uppercase">
{product.source}
</span>
</div>
<div className="p-3">
<h3 className="text-sm font-medium text-gray-800 truncate">{product.name}</h3>
<p className="text-orange-600 font-bold text-lg mt-1">₦{product.price}</p>
<button className="w-full mt-2 bg-orange-100 text-orange-600 py-2 rounded-lg font-semibold hover:bg-orange-500 hover:text-white transition-colors">
View on {product.source}
</button>
</div>
</div>
);
};