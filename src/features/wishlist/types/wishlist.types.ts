export interface WishlistItem {
  id: string;
  slug?: string;
  title: string;
  price: string;
  priceNum: number;
  image: string;
  link?: string;
  category?: string;
  sizes?: string[];
  dateAdded?: string;
}
