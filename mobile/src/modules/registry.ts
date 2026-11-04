import type { AppModule } from './types';
import { catalogModule } from './catalog';
import { cartModule } from './cart';
import { ordersModule } from './orders';

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
  catalogModule,
  cartModule,
  ordersModule,
];

export function enabledModules(disabledCsv: string): AppModule[] {
  const off = new Set(String(disabledCsv || '').split(',').map(s => s.trim()).filter(Boolean));
  return MODULES.filter(m => m.core || !off.has(m.id));
}
