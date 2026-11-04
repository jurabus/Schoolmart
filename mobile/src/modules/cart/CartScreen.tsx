import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSettings } from '@/core/settings';
import { useCart } from '@/core/cart';
import { Button, Card, Empty, ErrorView, Img, Loading, ModeTag, Notice, QtyStepper, Screen, Totals, st } from '@/core/ui';
import { money } from '@/core/format';
import { colors } from '@/core/theme';
import { useCartProducts } from './useCartProducts';

export function CartScreen() {
  const { S, deliveryFee, accent } = useSettings();
  const cart = useCart();
  const { lines, subtotal, loading, error, removed, reload } = useCartProducts();

  if (loading && cart.lines.length) return <Loading />;
  if (error) return <ErrorView message={error} onRetry={reload} />;

  if (!lines.length) {
    return (
      <Screen>
        {removed ? <Notice>{S.removed_items_notice}</Notice> : null}
        <Empty text={S.empty_cart} action={<Button title={S.continue_shopping} variant="primary" style={{ marginTop: 16 }} onPress={() => router.navigate('/')} />} />
      </Screen>
    );
  }

  return (
    <Screen onRefresh={reload}>
      {removed ? <Notice>{S.removed_items_notice}</Notice> : null}
      {cart.businessId ? (
        <Pressable onPress={() => router.push({ pathname: '/business/[id]', params: { id: cart.businessId! } })}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }} accessibilityRole="link">
          <Ionicons name="storefront-outline" size={18} color={accent} />
          <Text style={{ color: colors.muted }}>{S.supplier_label}</Text>
          <Text style={{ color: accent, fontWeight: '800', flex: 1 }} numberOfLines={1}>{cart.businessName}</Text>
        </Pressable>
      ) : null}
      <Card style={{ paddingVertical: 4 }}>
        {lines.map((l, i) => (
          <View key={l.id} style={{ flexDirection: 'row', gap: 12, paddingVertical: 14, borderTopWidth: i ? 1 : 0, borderColor: colors.line }}>
            <Pressable onPress={() => router.push({ pathname: '/product/[id]', params: { id: l.id } })}>
              <Img uri={l.p.image_url} label={l.p.name} style={{ width: 72, height: 72, borderRadius: 12 }} />
            </Pressable>
            <View style={{ flex: 1, gap: 6 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                <Text style={[st.bold, { flex: 1 }]} numberOfLines={2}>{l.p.name}</Text>
                <Pressable hitSlop={10} accessibilityLabel="Remove" onPress={() => cart.remove(l.id)}>
                  <Ionicons name="close" size={20} color={colors.muted} />
                </Pressable>
              </View>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <Text style={{ color: colors.muted }}>{money(l.p.price, S.currency)}</Text>
                <ModeTag mode={l.p.mode} />
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <QtyStepper value={l.qty} onChange={v => cart.setQty(l.id, v)} />
                <Text style={st.bold}>{money(Number(l.p.price) * l.qty, S.currency)}</Text>
              </View>
            </View>
          </View>
        ))}
      </Card>
      <Card style={{ marginTop: 16, gap: 14 }}>
        <Totals subtotal={subtotal} fee={deliveryFee} />
        <Button title={S.checkout_button} variant="primary" onPress={() => router.push('/cart/checkout')} />
        <Button title={S.continue_shopping} onPress={() => router.navigate('/')} />
      </Card>
    </Screen>
  );
}
