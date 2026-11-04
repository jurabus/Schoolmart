import type { AppModule } from '../types';
import { useCart } from '@/core/cart';

export const cartModule: AppModule = {
  id: 'cart',
  core: true,
  tab: {
    route: 'cart',
    title: S => S.cart_title,
    icon: 'cart-outline',
    order: 20,
    useBadge: () => { const n = useCart().count; return n > 0 ? n : undefined; },
  },
};

export { CartScreen } from './CartScreen';
export { CheckoutScreen } from './CheckoutScreen';
export { DoneScreen } from './DoneScreen';
