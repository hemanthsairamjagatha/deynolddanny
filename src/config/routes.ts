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
  occasion: '#occasion',
  fabric: '#fabric',
  journal: '#journal',
  mastery: '#mastery',
  styleSpace: '#style-space',
  latestNews: '#latest-news'
} as const;

export type AppRoute = (typeof routes)[keyof typeof routes];

export default routes;

