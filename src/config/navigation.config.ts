export interface NavItem {
  label: string;
  href: string;
}

export const primaryNavItems: NavItem[] = [
  { label: 'Women', href: '/categories/clothing' },
  { label: 'Men', href: '/categories/shirts' },
  { label: 'Shop by Occasion', href: '/#new-arrival' },
  { label: 'Shop by Category', href: '/categories' },
  { label: 'Shop by Fabric', href: '/#thread-of-mastery' },
  { label: 'Journal', href: '/#latest-news' }
];

export const drawerCollectionsNavItems: NavItem[] = [
  { label: 'Women', href: '/categories/clothing' },
  { label: 'Men', href: '/categories/shirts' },
  { label: 'Shop by Occasion', href: '/#new-arrival' },
  { label: 'Shop by Category', href: '/categories' },
  { label: 'Shop by Fabric', href: '/#thread-of-mastery' },
  { label: 'Journal', href: '/#latest-news' }
];

export const footerGetToKnowUs: NavItem[] = [
  { label: 'SEARCH', href: '/search' },
  { label: 'ABOUT US', href: '/#thread-of-mastery' },
  { label: 'CONTACT US', href: '/contact' }
];

export const footerCustomerCare: NavItem[] = [
  { label: 'TRACK YOUR ORDER', href: '/orders/track' },
  { label: 'RETURN AND EXCHANGE POLICY', href: '/legal/shipping-returns' },
  { label: 'PRIVACY POLICY', href: '/legal/privacy-policy' },
  { label: 'SHIPPING & DELIVERY', href: '/legal/shipping-returns' },
  { label: 'TERMS AND CONDITION', href: '/legal/terms' }
];

