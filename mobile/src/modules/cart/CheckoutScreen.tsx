import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { router } from 'expo-router';
import { sb, friendlyError } from '@/core/supabase';
import { useSettings } from '@/core/settings';
import { useCart } from '@/core/cart';
import { useAuth } from '@/core/auth';
import { addRecentOrder } from '@/core/recentOrders';
import { displayPhone } from '@/core/phone';
import { Button, Card, Empty, Field, Loading, ModeTag, Muted, Notice, Row, Screen, Totals, st } from '@/core/ui';
import { money } from '@/core/format';
import { colors } from '@/core/theme';
import { useCartProducts } from './useCartProducts';

export function CheckoutScreen() {
  const { S, deliveryFee } = useSettings();
  const cart = useCart();
  const auth = useAuth();
  const { lines, subtotal, loading, removed } = useCartProducts();
  const customer = auth.account.customer;
  const [address, setAddress] = useState(customer?.address || '');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (customer) setAddress(a => a || customer.address); }, [customer]);

  if (loading || auth.loading) return <Loading />;
  if (!lines.length) return <Empty text={S.empty_cart} />;

  if (auth.role !== 'customer') {
    const isBiz = auth.role === 'business' || auth.role === 'admin';
    return (
      <Screen>
        <Card style={{ gap: 14, alignItems: 'stretch' }}>
          <Text style={[st.h1, { marginBottom: 0, fontSize: 20 }]}>{S.checkout_title}</Text>
          {isBiz ? (
            <Notice>Business and admin accounts can't place orders. Log out and use a customer account.</Notice>
          ) : (
            <>
              <Muted left>{S.login_required}</Muted>
              <Button title={S.login_button} variant="primary" onPress={() => router.push({ pathname: '/account/login', params: { next: '/cart/checkout' } })} />
              <Button title={S.register_button} onPress={() => router.push({ pathname: '/account/register', params: { next: '/cart/checkout' } })} />
            </>
          )}
        </Card>
      </Screen>
    );
  }

  async function submit() {
    setErr('');
    const a = address.trim();
    if (!a) return setErr(S.err_required);
    setBusy(true);
    const { data, error } = await sb.rpc('place_order', {
      p_first_name: customer!.first_name, p_last_name: customer!.last_name, p_phone: customer!.phone, p_address: a,
      p_items: cart.lines.map(l => ({ product_id: l.id, quantity: l.qty })),
    });
    setBusy(false);
    if (error || !data?.order_code) return setErr(friendlyError(error?.message));
    addRecentOrder({ code: data.order_code, phone: customer!.phone, at: new Date().toISOString() });
    cart.clear();
    router.replace({ pathname: '/cart/done', params: { code: data.order_code, phone: customer!.phone } });
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <Screen>
        {removed ? <Notice>{S.removed_items_notice}</Notice> : null}
        <Card style={{ gap: 10 }}>
          {cart.businessName ? <Text style={[st.bold, { fontSize: 16 }]}>{cart.businessName}</Text> : null}
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
          <Row l={S.lbl_name} r={`${customer!.first_name} ${customer!.last_name}`} />
          <Row l={S.f_phone} r={displayPhone(customer!.phone)} />
          <Field label={S.f_address} value={address} onChangeText={setAddress} maxLength={500} multiline autoComplete="street-address" textContentType="fullStreetAddress" />
          {S.checkout_note ? <Muted small left>{S.checkout_note}</Muted> : null}
          {err ? <Notice kind="error">{err}</Notice> : null}
          <Button title={S.place_order_button} variant="primary" loading={busy} onPress={submit} />
        </Card>
      </Screen>
    </KeyboardAvoidingView>
  );
}
