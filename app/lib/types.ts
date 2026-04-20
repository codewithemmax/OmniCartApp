export type Source = "Jumia" | "Konga" | "Temu" | "Amazon";

export interface Product {
  id: string;
  name: string;
  price: number;
  image: string;
  source: Source;
  inStock: boolean;
  deliveryDays: number;
  url: string;
  rating: number;       // 0–5
  reviewCount: number;
}

export interface BundleItem {
  role: string;         // e.g. "Phone", "Case", "Charger"
  product: Product;
}

export interface Bundle {
  items: BundleItem[];
  totalPrice: number;
  savings: number;      // vs buying each from most expensive source
}
