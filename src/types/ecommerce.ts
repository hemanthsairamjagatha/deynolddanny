export interface CartItem {
  id: string;
  title: string;
  price: string;
  priceNum: number;
  size: string;
  img: string;
  qty: number;
}

export interface ProductColor {
  name: string;
  hex: string;
  img?: string;
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
  colors?: ProductColor[];
}

export interface CategoryCardData {
  id: string;
  title: string;
  subtitle: string;
  tagline: string;
  image: string;
  link?: string;
}
