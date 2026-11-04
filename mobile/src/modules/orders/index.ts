import type { AppModule } from '../types';

export const ordersModule: AppModule = {
  id: 'orders',
  tab: { route: 'track', title: S => S.nav_track, icon: 'receipt-outline', order: 30 },
};

export { TrackScreen } from './TrackScreen';
