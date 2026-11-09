import type { ProductCardData } from '../types/product.types';

export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-');
}

export function formatPrice(priceNum: number, currency: string = '₹'): string {
  const formatted = priceNum.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return `${currency} ${formatted}`;
}

export function getProductSlug(product: ProductCardData): string {
  if (product.slug) return product.slug;
  return slugify(product.title) || product.id;
}

