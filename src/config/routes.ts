export const routes = {
  home: '/',
  search: '/search',
  account: '/account/sign-in',
  signIn: '/account/sign-in',
  signUp: '/account/sign-up',
  forgotPassword: '/account/forgot-password',
  wishlist: '/wishlist',
  cart: '/cart',
  categories: '/categories',
  category: '/categories',
  women: '/categories/clothing',
  men: '/categories/shirts',
  occasion: '/#new-arrival',
  fabric: '/#thread-of-mastery',
  journal: '/#latest-news',
  mastery: '/#thread-of-mastery',
  newArrival: '/#new-arrival',
  latestNews: '/#latest-news',
  contact: '/contact',
  trackOrder: '/orders/track'
} as const;

export type AppRoute = (typeof routes)[keyof typeof routes];

export default routes;

