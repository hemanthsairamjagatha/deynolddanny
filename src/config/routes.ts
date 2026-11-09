export const routes = {
  home: '/',
  search: '#search',
  account: '#account',
  wishlist: '#wishlist',
  cart: '#cart',
  women: '#women',
  men: '#men',
  occasion: '#occasion',
  category: '#category',
  fabric: '#fabric',
  journal: '#journal',
  mastery: '#mastery',
  styleSpace: '#style-space',
  latestNews: '#latest-news'
} as const;

export type AppRoute = (typeof routes)[keyof typeof routes];

export default routes;

