import { StatusBar } from 'expo-status-bar';
import { Stack } from 'expo-router/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SettingsProvider } from '@/core/settings';
import { AuthProvider } from '@/core/auth';
import { CartProvider } from '@/core/cart';
import { ConfirmProvider } from '@/core/confirm';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SettingsProvider>
        <AuthProvider>
          <CartProvider>
            <ConfirmProvider>
              <StatusBar style="dark" />
              <Stack screenOptions={{ headerShown: false }} />
            </ConfirmProvider>
          </CartProvider>
        </AuthProvider>
      </SettingsProvider>
    </SafeAreaProvider>
  );
}
