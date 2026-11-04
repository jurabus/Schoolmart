import type { AppModule } from '../types';

/** Business dashboard: two tabs, shown only to business accounts. */
export const businessOrdersModule: AppModule = {
  id: 'business',
  tab: { route: 'biz-orders', title: () => 'Orders', icon: 'receipt-outline', order: 10, roles: ['business'] },
};
export const businessProductsModule: AppModule = {
  id: 'business',
  tab: { route: 'biz-products', title: () => 'Products', icon: 'pricetags-outline', order: 20, roles: ['business'] },
};

export { BizOrdersScreen } from './BizOrdersScreen';
export { BizOrderDetailScreen } from './BizOrderDetailScreen';
export { BizProductsScreen } from './BizProductsScreen';
export { BizProductFormScreen } from './BizProductFormScreen';
