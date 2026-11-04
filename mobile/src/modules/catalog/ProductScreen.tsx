import { useEffect, useState } from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { isUuid, PRODUCT_COLUMNS, sb, type Product } from '@/core/supabase';
import { useSettings } from '@/core/settings';
import { useCart, type CartProductRef } from '@/core/cart';
import { useConfirm } from '@/core/confirm';
import { useQuery, unwrap } from '@/core/useQuery';
import { Button, Empty, ErrorView, Img, Loading, ModeTag, Notice, QtyStepper, Screen, st } from '@/core/ui';
import { money } from '@/core/format';
import { colors, radius } from '@/core/theme';

export function ProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { S, accent } = useSettings();
  const cart = useCart();
  const confirm = useConfirm();
  const nav = useNavigation();
  const { width } = useWindowDimensions();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  const q = useQuery(() => isUuid(id)
    ? unwrap<Product | null>(sb.from('products').select(PRODUCT_COLUMNS).eq('id', id).maybeSingle())
    : Promise.resolve(null), [id]);

  useEffect(() => { if (q.data) nav.setOptions({ title: q.data.name }); }, [q.data, nav]);

  if (q.loading) return <Loading />;
  if (q.error) return <ErrorView message={q.error} onRetry={q.reload} />;
  const p = q.data;
  if (!p) return <Empty text={S.not_found_page} />;

  const off = p.mode === 'unavailable';
  const label = off ? S.btn_unavailable : p.mode === 'preorder' ? S.btn_preorder : S.btn_order;
  const ref: CartProductRef = { id: p.id, business_id: p.business_id, businessName: p.businesses?.name || '' };
  const flashAdded = () => { setAdded(true); setTimeout(() => setAdded(false), 2000); };

  async function onAdd() {
    const r = cart.add(ref, qty);
    if (r.ok) return flashAdded();
    const yes = await confirm({
      title: S.new_cart_title,
      message: S.new_cart_message.replace('{store}', r.conflictWith || 'another supplier'),
      confirmText: S.btn_order,
    });
    if (yes) { cart.startNewCart(ref, qty); flashAdded(); }
  }

  return (
    <Screen onRefresh={q.reload}>
      <View style={{ flexDirection: width >= 760 ? 'row' : 'column', gap: 20 }}>
        <View style={{ flex: width >= 760 ? 1 : undefined }}>
          <Img uri={p.image_url} label={p.name} style={{ width: '100%', aspectRatio: 1, borderRadius: radius.md }} />
        </View>
        <View style={{ flex: width >= 760 ? 1 : undefined, gap: 12 }}>
          <Text style={st.h1}>{p.name}</Text>
          {p.businesses?.name ? (
            <Pressable onPress={() => router.push({ pathname: '/business/[id]', params: { id: p.business_id } })}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: -6 }} accessibilityRole="link">
              <Ionicons name="storefront-outline" size={16} color={accent} />
              <Text style={{ color: colors.muted }}>{S.supplier_label} </Text>
              <Text style={{ color: accent, fontWeight: '700' }}>{p.businesses.name}</Text>
            </Pressable>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={{ color: accent, fontSize: 24, fontWeight: '800' }}>{money(p.price, S.currency)}</Text>
            <ModeTag mode={p.mode} />
          </View>
          {p.mode === 'preorder' && S.preorder_note ? <Notice kind="info">{S.preorder_note}</Notice> : null}
          {p.description ? <Text style={{ color: '#44403c', fontSize: 16, lineHeight: 23 }}>{p.description}</Text> : null}
          {off ? null : (
            <View style={{ gap: 6 }}>
              <Text style={st.label}>{S.quantity_label}</Text>
              <QtyStepper value={qty} onChange={setQty} />
            </View>
          )}
          <Button title={added ? `✓ ${S.added_to_cart}` : label} variant="primary" disabled={off} onPress={onAdd} />
          {cart.lines.some(l => l.id === p.id) ? (
            <Button title={`${S.cart_title} →`} onPress={() => router.navigate('/cart')} />
          ) : null}
        </View>
      </View>
    </Screen>
  );
}
