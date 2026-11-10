export interface CartItem {
  id: string;
  title: string;
  price: string;
  priceNum: number;
  size: string;
  img: string;
  qty: number;
  variantId?: string;
  backendItemId?: string;
}

