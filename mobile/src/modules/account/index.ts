import { ALL_ROLES, type AppModule } from '../types';

export const accountModule: AppModule = {
  id: 'account',
  core: true,
  tab: { route: 'account', title: S => S.nav_account, icon: 'person-circle-outline', order: 90, roles: ALL_ROLES },
};

export { AccountScreen } from './AccountScreen';
export { LoginScreen } from './LoginScreen';
export { RegisterScreen } from './RegisterScreen';
export { EditProfileScreen } from './EditProfileScreen';
export { PasswordScreen } from './PasswordScreen';
