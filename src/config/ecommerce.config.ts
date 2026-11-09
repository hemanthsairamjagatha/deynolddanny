export interface EcommerceConfig {
  currencySymbol: string;
  currencyCode: string;
  locale: string;
  freeShippingThreshold: number;
}

export const ecommerceConfig: EcommerceConfig = {
  currencySymbol: '₹',
  currencyCode: 'INR',
  locale: 'en-IN',
  freeShippingThreshold: 50000
};

export default ecommerceConfig;

