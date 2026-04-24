export type Source = "Amazon" | "Jumia" | "Konga" | "Temu";

export interface Product {
  id: string;
  name: string;
  price: number;
  image: string;
  source: Source;
  inStock: boolean;
  deliveryDays: number;
  url: string;
  rating: number;
  reviewCount: number;
}

export interface BundleItem {
  role: string;
  product: Product;
}

export interface Bundle {
  items: BundleItem[];
  totalPrice: number;
  savings: number;
}
