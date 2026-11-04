import { Tabs } from 'expo-router/js-tabs';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSettings } from '@/core/settings';
import { MODULES, enabledModules } from '@/modules/registry';
import { colors } from '@/core/theme';

// Builds the bottom tab bar from the module registry (src/modules/registry.ts).
export default function TabsLayout() {
  const { S, accent } = useSettings();
  const enabled = new Set(enabledModules(S.app_disabled_modules).map(m => m.id));
  const tabs = MODULES.filter(m => m.tab).sort((a, b) => a.tab!.order - b.tab!.order);
  // Badge hooks run in a fixed order (the registry is static), so this is hook-safe.
  const badges = tabs.map(m => m.tab!.useBadge?.());

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
      {tabs.map((m, i) => (
        <Tabs.Screen
          key={m.id}
          name={m.tab!.route}
          options={{
            title: m.tab!.title(S),
            href: enabled.has(m.id) ? undefined : null,
            tabBarBadge: badges[i],
            tabBarIcon: ({ color, size }) => <Ionicons name={m.tab!.icon} color={String(color)} size={size} />,
          }}
        />
      ))}
    </Tabs>
  );
}
