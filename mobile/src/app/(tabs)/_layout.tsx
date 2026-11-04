import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Tabs } from 'expo-router/js-tabs';
import { router, useSegments } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSettings } from '@/core/settings';
import { useAuth } from '@/core/auth';
import { MODULES, homeRouteFor, tabsFor } from '@/modules/registry';
import { colors } from '@/core/theme';

// Every tab any module can add, in a fixed order, so badge hooks always run in the same order.
const ALL_TABS = MODULES.filter(m => m.tab);

/** Bottom tabs come from the module registry and depend on who is logged in. */
export default function TabsLayout() {
  const { S, accent } = useSettings();
  const { role, loading } = useAuth();
  const segments = useSegments() as string[];
  const tabs = tabsFor(role, S.app_disabled_modules);
  const visible = new Set(tabs.filter(t => t.visible).map(t => t.module.tab!.route));
  const badges = ALL_TABS.map(m => m.tab!.useBadge?.());
  // If the current tab isn't allowed for this role (e.g. a business just logged in on the shop tab,
  // or a business logged out on its dashboard), go to that role's home. Otherwise stay put,
  // so "log in to check out" returns the customer straight to checkout.
  useEffect(() => {
    if (loading) return;
    const current = String(segments[1] ?? '');
    if (current && !visible.has(current)) router.replace(homeRouteFor(role) as never);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, loading, segments[1]]);

  // Build the tab bar only once we know who is logged in; otherwise a business opening
  // the app on its Products screen would briefly get the guest tabs and lose that screen.
  if (loading) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}><ActivityIndicator color={accent} /></View>;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.line },
        tabBarBadgeStyle: { backgroundColor: accent, color: '#fff' },
      }}
    >
      {tabs.map(({ module: m, visible: show }) => (
        <Tabs.Screen
          key={m.tab!.route}
          name={m.tab!.route}
          options={{
            title: m.tab!.title(S),
            href: show ? undefined : null,
            tabBarBadge: badges[ALL_TABS.indexOf(m)],
            tabBarIcon: ({ color, size }) => <Ionicons name={m.tab!.icon} color={String(color)} size={size} />,
          }}
        />
      ))}
    </Tabs>
  );
}
