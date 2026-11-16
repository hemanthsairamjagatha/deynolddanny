export interface ProductColor {
  name: string;
  hex: string;
  img?: string;
  swatchImg?: string;
  images?: string[];
}

export interface ProductVariant {
  id: string;
  sku?: string;
  size: string;
  colorName: string;
  colorHex: string;
  stock: number;
  reservedStock: number;
  inStock?: boolean;
}

export interface RelatedItem {
  id: string;
  title: string;
  price: string;
  priceNum: number;
  image: string;
  link: string;
  badge?: string;
}

export interface ProductCardData {
  id: string;
  slug?: string;
  badge?: string;
  tag?: string;
  title: string;
  price: string;
  priceNum: number;
  defaultImg: string;
  hoverImg: string;
  images?: string[];
  sizes: string[];
  link?: string;
  colors?: ProductColor[];
  variants?: ProductVariant[];
  sku?: string;
  category?: string;
  subCategory?: string;
  gender?: string;
  description?: string;
  details?: string[];
  sizeAndFit?: string[];
  compositionAndCare?: string[];
  shippingAndReturns?: string[];
  styleItWith?: RelatedItem[];
  relatedProducts?: RelatedItem[];
}

export interface CategoryCardData {
  id: string;
  title: string;
  subtitle: string;
  tagline: string;
  image: string;
  link?: string;
}
