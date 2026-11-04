import { SHOPPER_ROLES, type AppModule } from '../types';

export const ordersModule: AppModule = {
  id: 'orders',
  tab: { route: 'track', title: S => S.nav_orders, icon: 'receipt-outline', order: 30, roles: SHOPPER_ROLES },
};

export { OrdersScreen } from './OrdersScreen';
export { OrderDetailScreen } from './OrderDetailScreen';
export { TrackScreen } from './TrackScreen';
