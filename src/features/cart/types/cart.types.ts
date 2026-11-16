export interface CartItem {
  id: string;
  slug?: string;
  title: string;
  price: string;
  priceNum: number;
  size: string;
  color?: string;
  img: string;
  qty: number;
  variantId?: string;
  backendItemId?: string;
}

