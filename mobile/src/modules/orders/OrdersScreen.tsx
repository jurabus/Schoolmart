import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { sb, type OrderStatus } from '@/core/supabase';
import { useAuth } from '@/core/auth';
import { useSettings } from '@/core/settings';
import { Button, Card, Empty, ErrorView, Muted, Tag } from '@/core/ui';
import { fmtDate, money } from '@/core/format';
import { colors, radius, space, statusColors } from '@/core/theme';
import { TrackScreen } from './TrackScreen';

interface Row { id: string; order_code: string; status: OrderStatus; total: number; created_at: string; businesses: { name: string } | null }
const PAGE = 20;

/** Customers see their order history; guests get "track by code" and an invitation to log in. */
export function OrdersScreen() {
  const auth = useAuth();
  if (auth.role === 'customer') return <MyOrders />;
  return (
    <View style={{ flex: 1 }}>
      <TrackScreen header={auth.role === 'guest' ? <GuestPrompt /> : null} />
    </View>
  );
}

function GuestPrompt() {
  const { S } = useSettings();
  return (
    <Card style={{ gap: 10, marginBottom: 16 }}>
      <Text style={{ fontWeight: '800', color: colors.text, fontSize: 16 }}>{S.my_orders_title}</Text>
      <Muted left>Log in to see all your orders in one place.</Muted>
      <Button title={S.login_button} variant="primary" onPress={() => router.push({ pathname: '/account/login', params: { next: '/track' } })} />
    </Card>
  );
}

function MyOrders() {
  const { S, accent } = useSettings();
  const auth = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [more, setMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const uid = auth.session?.user.id;

  const load = useCallback(async (reset: boolean) => {
    if (!uid || (busy.current && !reset)) return;
    busy.current = true;
    const from = reset ? 0 : rows.length;
    const { data, error: e } = await sb.from('orders')
      .select('id,order_code,status,total,created_at,businesses(name)')
      .eq('customer_id', uid).order('created_at', { ascending: false }).range(from, from + PAGE - 1);
    busy.current = false;
    setLoading(false); setRefreshing(false);
    if (e) { setError(e.message); return; }
    setError(null);
    const got = (data || []) as unknown as Row[];
    setRows(prev => (reset ? got : [...prev, ...got]));
    setMore(got.length === PAGE);
  }, [uid, rows.length]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useFocusEffect(useCallback(() => { load(true); }, [uid]));

  if (error && !rows.length) return <ErrorView message={error} onRetry={() => load(true)} />;

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: space, paddingBottom: 48 }}
      data={rows}
      keyExtractor={r => r.id}
      refreshControl={<RefreshControl refreshing={refreshing} tintColor={accent} colors={[accent]} onRefresh={() => { setRefreshing(true); load(true); }} />}
      onEndReachedThreshold={0.5}
      onEndReached={() => { if (more && !loading) load(false); }}
      ListHeaderComponent={<Text style={{ fontSize: 26, fontWeight: '800', color: colors.text, marginBottom: 12 }}>{S.my_orders_title}</Text>}
      renderItem={({ item }) => {
        const sc = statusColors[item.status] || statusColors.new;
        return (
          <Pressable onPress={() => router.push({ pathname: '/track/[id]', params: { id: item.id } })}
            style={({ pressed }) => [{ backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: 14, marginBottom: 10, gap: 6 }, pressed && { opacity: 0.85 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontWeight: '800', color: colors.text, flex: 1 }} numberOfLines={1}>{item.businesses?.name || '—'}</Text>
              <Tag text={(S as Record<string, unknown>)['status_' + item.status] as string || item.status} bg={sc.bg} fg={sc.fg} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: colors.muted }}>{item.order_code} · {fmtDate(item.created_at)}</Text>
              <Text style={{ fontWeight: '800', color: accent }}>{money(item.total, S.currency)}</Text>
            </View>
          </Pressable>
        );
      }}
      ListEmptyComponent={loading ? <ActivityIndicator color={accent} style={{ marginTop: 40 }} /> : (
        <Empty text={S.no_orders} action={<Button title={S.continue_shopping} variant="primary" style={{ marginTop: 16 }} onPress={() => router.navigate('/')} />} />
      )}
      ListFooterComponent={more && rows.length ? <ActivityIndicator color={accent} style={{ marginVertical: 16 }} /> : undefined}
    />
  );
}
