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
      <Stack.Screen name="index" options={{ title: S.nav_account }} />
      <Stack.Screen name="login" options={{ title: S.login_title }} />
      <Stack.Screen name="register" options={{ title: S.register_title }} />
      <Stack.Screen name="edit" options={{ title: S.edit_profile }} />
      <Stack.Screen name="password" options={{ title: S.change_password }} />
    </Stack>
  );
}
