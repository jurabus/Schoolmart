import { StatusBar } from 'expo-status-bar';
import { Stack } from 'expo-router/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SettingsProvider } from '@/core/settings';
import { CartProvider } from '@/core/cart';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SettingsProvider>
        <CartProvider>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false }} />
        </CartProvider>
      </SettingsProvider>
    </SafeAreaProvider>
  );
}
