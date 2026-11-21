export interface ProductColor {
  name: string;
  hex: string;
  img?: string;
  hoverImg?: string;
  swatchImg?: string;
  images?: string[];
  pricePaise?: number;
  price?: string;
  priceNum?: number;
  comparePaise?: number | null;
  comparePrice?: string | null;
  hasCustomPrice?: boolean;
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
  pricePaise?: number;
  price?: string;
  priceNum?: number;
  comparePaise?: number | null;
  comparePrice?: string | null;
  hasCustomPrice?: boolean;
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
  badge?: string | null;
  tag?: string | null;
  title: string;
  price: string;
  priceNum: number;
  comparePrice?: string | null;
  defaultImg: string;
  hoverImg: string;
  images?: string[];
  sizes: string[];
  link?: string;
  colors?: ProductColor[];
  variants?: ProductVariant[];
  sku?: string;
  sectionGroup?: string;
  categoryId?: string | null;
  category?: string;
  subCategory?: string;
  gender?: string | null;
  description?: string | null;
  material?: string | null;
  careGuide?: string | null;
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
  focalX?: number;
  focalY?: number;
}
