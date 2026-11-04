import type { ComponentProps } from 'react';
import type Ionicons from '@expo/vector-icons/Ionicons';
import type { Settings } from '@/core/settings';

export type IconName = ComponentProps<typeof Ionicons>['name'];

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
    /** Optional hook returning a badge number (called on every render of the tab bar). */
    useBadge?: () => number | undefined;
  };
}
