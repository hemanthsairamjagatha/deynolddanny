export interface CartItem {
  id: string;
  title: string;
  price: string;
  priceNum: number;
  size: string;
  img: string;
  qty: number;
}

export interface ProductCardData {
  id: string;
  badge?: string;
  title: string;
  price: string;
  priceNum: number;
  defaultImg: string;
  hoverImg: string;
  sizes: string[];
  link?: string;
}

export interface CategoryCardData {
  id: string;
  title: string;
  subtitle: string;
  tagline: string;
  image: string;
  link?: string;
}
