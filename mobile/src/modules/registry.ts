import type { AppModule } from './types';
import type { Role } from '@/core/auth';
import { searchModule } from './search';
import { catalogModule } from './catalog';
import { cartModule } from './cart';
import { ordersModule } from './orders';
import { accountModule } from './account';
import { businessOrdersModule, businessProductsModule } from './business';

/**
 * ┌───────────────────────────────────────────────────────────────┐
 * │  PLUG-AND-PLAY MODULES                                         │
 * │  To add a feature: create src/modules/<id>/, export an          │
 * │  AppModule from its index.ts, and add it to this list.         │
 * │  To remove one: delete it from this list (and its routes).     │
 * │  To hide one without an app update: in the website admin,       │
 * │  set "app_disabled_modules" (comma separated ids).             │
 * └───────────────────────────────────────────────────────────────┘
 */
export const MODULES: AppModule[] = [
  searchModule,
  catalogModule,
  cartModule,
  ordersModule,
  accountModule,
  businessOrdersModule,
  businessProductsModule,
];

export function enabledModules(disabledCsv: string): AppModule[] {
  const off = new Set(String(disabledCsv || '').split(',').map(s => s.trim()).filter(Boolean));
  return MODULES.filter(m => m.core || !off.has(m.id));
}

export function tabsFor(role: Role, disabledCsv: string) {
  const enabled = new Set(enabledModules(disabledCsv).map(m => m.id));
  return MODULES.filter(m => m.tab).sort((a, b) => a.tab!.order - b.tab!.order)
    .map(m => ({ module: m, visible: enabled.has(m.id) && m.tab!.roles.includes(role) }));
  // Note: a module may add several tabs by exporting several AppModule entries with the same id.
}

/** Home-screen top blocks from enabled modules (e.g. search bar). */
export function homeTops(disabledCsv: string) {
  return enabledModules(disabledCsv).filter(m => m.HomeTop).map(m => ({ id: m.id, Component: m.HomeTop! }));
}

/** Where each role lands when the app opens or after logging in. */
export const homeRouteFor = (role: Role) => (role === 'business' ? '/biz-orders' : '/');
