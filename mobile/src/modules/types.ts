import type { ComponentProps, ComponentType } from 'react';
import type Ionicons from '@expo/vector-icons/Ionicons';
import type { Settings } from '@/core/settings';
import type { Role } from '@/core/auth';

export type IconName = ComponentProps<typeof Ionicons>['name'];

/** Props a module receives when it adds something to the top of the home screen. */
export interface HomeTopProps { onActiveChange: (active: boolean) => void }

/**
 * A feature module. Each module lives in src/modules/<id>/ and owns its screens.
 * If it adds a bottom tab, its route folder lives in src/app/(tabs)/<route>/.
 */
export interface AppModule {
  /** Unique id. Also used to switch the module off remotely (admin setting "app_disabled_modules"). */
  id: string;
  /** Core modules can never be switched off remotely. */
  core?: boolean;
  /** Bottom tab this module adds (omit for modules without a tab). */
  tab?: {
    /** Folder name under src/app/(tabs)/ */
    route: string;
    title: (S: Settings) => string;
    icon: IconName;
    /** Position in the tab bar (lower = further left). */
    order: number;
    /** Which kinds of user see this tab. */
    roles: Role[];
    /** Optional hook returning a badge number (called on every render of the tab bar). */
    useBadge?: () => number | undefined;
  };
  /** Optional block shown at the top of the home screen (e.g. the search bar). */
  HomeTop?: ComponentType<HomeTopProps>;
}

/** Shopper-facing roles (everyone except business accounts). */
export const SHOPPER_ROLES: Role[] = ['guest', 'customer', 'admin', 'none'];
export const ALL_ROLES: Role[] = ['guest', 'customer', 'business', 'admin', 'none'];
