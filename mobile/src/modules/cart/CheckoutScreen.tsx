import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { router } from 'expo-router';
import { sb } from '@/core/supabase';
import { useSettings } from '@/core/settings';
import { useCart } from '@/core/cart';
import { addRecentOrder } from '@/core/recentOrders';
import { Button, Card, Empty, Field, Loading, ModeTag, Muted, Notice, Screen, Totals, st } from '@/core/ui';
import { digits, money } from '@/core/format';
import { colors } from '@/core/theme';
import { useCartProducts } from './useCartProducts';

export function CheckoutScreen() {
  const { S, deliveryFee } = useSettings();
  const cart = useCart();
  const { lines, subtotal, loading, removed } = useCartProducts();
  const [f, setF] = useState({ first: '', last: '', phone: '', address: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF(x => ({ ...x, [k]: v }));

  if (loading) return <Loading />;
  if (!lines.length) return <Empty text={S.empty_cart} />;

  async function submit() {
    setErr('');
    const v = { first: f.first.trim(), last: f.last.trim(), phone: f.phone.trim(), address: f.address.trim() };
    if (!v.first || !v.last || !v.phone || !v.address) return setErr(S.err_required);
    const d = digits(v.phone);
    if (d.length < 7 || d.length > 15) return setErr(S.err_phone);
    setBusy(true);
    const { data, error } = await sb.rpc('place_order', {
      p_first_name: v.first, p_last_name: v.last, p_phone: v.phone, p_address: v.address,
      p_items: cart.lines.map(l => ({ product_id: l.id, quantity: l.qty })),
    });
    setBusy(false);
    if (error || !data?.order_code) return setErr(error?.message || 'Something went wrong. Please try again.');
    addRecentOrder({ code: data.order_code, phone: d, at: new Date().toISOString() });
    cart.clear();
    router.replace({ pathname: '/cart/done', params: { code: data.order_code, phone: d } });
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <Screen>
        {removed ? <Notice>{S.removed_items_notice}</Notice> : null}
        <Card style={{ gap: 10 }}>
          {lines.map(l => (
            <View key={l.id} style={[st.row, { alignItems: 'center' }]}>
              <View style={{ flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <Text style={{ color: colors.text }}>{l.p.name} × {l.qty}</Text>
                <ModeTag mode={l.p.mode} />
              </View>
              <Text style={{ color: colors.text }}>{money(Number(l.p.price) * l.qty, S.currency)}</Text>
            </View>
          ))}
          <View style={st.hr} />
          <Totals subtotal={subtotal} fee={deliveryFee} />
        </Card>

        <Card style={{ marginTop: 16, gap: 14 }}>
          <Field label={S.f_first_name} value={f.first} onChangeText={set('first')} maxLength={60} autoComplete="given-name" textContentType="givenName" />
          <Field label={S.f_last_name} value={f.last} onChangeText={set('last')} maxLength={60} autoComplete="family-name" textContentType="familyName" />
          <Field label={S.f_phone} value={f.phone} onChangeText={set('phone')} maxLength={20} keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" />
          <Field label={S.f_address} value={f.address} onChangeText={set('address')} maxLength={500} multiline autoComplete="street-address" textContentType="fullStreetAddress" />
          {S.checkout_note ? <Muted small left>{S.checkout_note}</Muted> : null}
          {err ? <Notice kind="error">{err}</Notice> : null}
          <Button title={S.place_order_button} variant="primary" loading={busy} onPress={submit} />
        </Card>
      </Screen>
    </KeyboardAvoidingView>
  );
}
