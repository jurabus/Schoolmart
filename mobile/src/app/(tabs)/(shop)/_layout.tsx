import { Stack } from 'expo-router/stack';
import { useSettings } from '@/core/settings';
import { colors } from '@/core/theme';

export default function Layout() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
      <Stack.Screen name="index" options={{ title: S.store_name }} />
      <Stack.Screen name="search" options={{ title: 'Search' }} />
      <Stack.Screen name="business/[id]" options={{ title: '' }} />
      <Stack.Screen name="category/[id]" options={{ title: '' }} />
      <Stack.Screen name="subcategory/[id]" options={{ title: '' }} />
      <Stack.Screen name="product/[id]" options={{ title: '' }} />
    </Stack>
  );
}
