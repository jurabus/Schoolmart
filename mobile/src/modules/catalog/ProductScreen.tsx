import { useEffect, useState } from 'react';
import { Text, View, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { isUuid, sb, type Product } from '@/core/supabase';
import { useSettings } from '@/core/settings';
import { useCart } from '@/core/cart';
import { useQuery, unwrap } from '@/core/useQuery';
import { Button, Empty, ErrorView, Img, Loading, ModeTag, Notice, QtyStepper, Screen, st } from '@/core/ui';
import { money } from '@/core/format';
import { colors, radius } from '@/core/theme';

export function ProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { S, accent } = useSettings();
  const cart = useCart();
  const nav = useNavigation();
  const { width } = useWindowDimensions();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  const q = useQuery(() => isUuid(id)
    ? unwrap<Product | null>(sb.from('products').select('id,name,description,image_url,price,mode').eq('id', id).maybeSingle())
    : Promise.resolve(null), [id]);

  useEffect(() => { if (q.data) nav.setOptions({ title: q.data.name }); }, [q.data, nav]);

  if (q.loading) return <Loading />;
  if (q.error) return <ErrorView message={q.error} onRetry={q.reload} />;
  const p = q.data;
  if (!p) return <Empty text={S.not_found_page} />;

  const off = p.mode === 'unavailable';
  const label = off ? S.btn_unavailable : p.mode === 'preorder' ? S.btn_preorder : S.btn_order;

  return (
    <Screen onRefresh={q.reload}>
      <View style={{ flexDirection: width >= 760 ? 'row' : 'column', gap: 20 }}>
        <View style={{ flex: width >= 760 ? 1 : undefined }}>
          <Img uri={p.image_url} label={p.name} style={{ width: '100%', aspectRatio: 1, borderRadius: radius.md }} />
        </View>
        <View style={{ flex: width >= 760 ? 1 : undefined, gap: 12 }}>
          <Text style={st.h1}>{p.name}</Text>
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
          <Button
            title={added ? `✓ ${S.added_to_cart}` : label}
            variant="primary"
            disabled={off}
            onPress={() => { cart.add(p.id, qty); setAdded(true); setTimeout(() => setAdded(false), 2000); }}
          />
          {cart.lines.some(l => l.id === p.id) ? (
            <Button title={`${S.cart_title} →`} onPress={() => router.navigate('/cart')} />
          ) : null}
          <View style={{ height: 1, backgroundColor: colors.line, marginTop: 8 }} />
        </View>
      </View>
    </Screen>
  );
}
