import { Stack } from 'expo-router/stack';
import { useSettings } from '@/core/settings';
import { colors } from '@/core/theme';

export default function Layout() {
  const { S, accent } = useSettings();
  return (
    <Stack
      screenOptions={{
        headerTintColor: accent,
        headerTitleStyle: { color: colors.text },
        headerStyle: { backgroundColor: colors.surface },
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="index" options={{ title: S.nav_track }} />
    </Stack>
  );
}
