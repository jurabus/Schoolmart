import { SHOPPER_ROLES, type AppModule } from '../types';

export const catalogModule: AppModule = {
  id: 'catalog',
  core: true,
  tab: { route: '(shop)', title: S => S.lbl_home, icon: 'storefront-outline', order: 10, roles: SHOPPER_ROLES },
};

export { HomeScreen } from './HomeScreen';
export { BusinessScreen } from './BusinessScreen';
export { CategoryScreen } from './CategoryScreen';
export { SubcategoryScreen } from './SubcategoryScreen';
export { ProductScreen } from './ProductScreen';
