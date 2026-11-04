import type { AppModule } from '../types';

export const catalogModule: AppModule = {
  id: 'catalog',
  core: true,
  tab: { route: '(shop)', title: S => S.lbl_home, icon: 'storefront-outline', order: 10 },
};

export { HomeScreen } from './HomeScreen';
export { CategoryScreen } from './CategoryScreen';
export { SubcategoryScreen } from './SubcategoryScreen';
export { ProductScreen } from './ProductScreen';
