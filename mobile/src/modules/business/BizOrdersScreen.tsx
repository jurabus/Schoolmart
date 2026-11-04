import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { ORDER_STATUSES, sb, type OrderStatus } from '@/core/supabase';
import { useAuth } from '@/core/auth';
import { useSettings } from '@/core/settings';
import { Empty, ErrorView, Notice, Tag } from '@/core/ui';
import { fmtDate, money } from '@/core/format';
import { colors, radius, space, statusColors } from '@/core/theme';

interface Row { id: string; order_code: string; first_name: string; last_name: string; status: OrderStatus; total: number; created_at: string }
const PAGE = 25;
type Filter = 'all' | OrderStatus;

/** Orders placed with THIS business only (enforced by the database). */
export function BizOrdersScreen() {
  const { S, accent } = useSettings();
  const auth = useAuth();
  const biz = auth.account.business;
  const [filter, setFilter] = useState<Filter>('new');
  const [rows, setRows] = useState<Row[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [more, setMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);

  const loadCounts = useCallback(async () => {
    if (!biz) return;
    const res = await Promise.all(ORDER_STATUSES.map(st =>
      sb.from('orders').select('id', { count: 'exact', head: true }).eq('business_id', biz.id).eq('status', st)));
    const c: Record<string, number> = {};
    ORDER_STATUSES.forEach((st, i) => { c[st] = res[i].count ?? 0; });
    setCounts(c);
  }, [biz]);

  const load = useCallback(async (reset: boolean, f: Filter = filter) => {
    if (!biz || (busy.current && !reset)) return;
    busy.current = true;
    const from = reset ? 0 : rows.length;
    let q = sb.from('orders').select('id,order_code,first_name,last_name,status,total,created_at')
      .eq('business_id', biz.id).order('created_at', { ascending: false }).range(from, from + PAGE - 1);
    if (f !== 'all') q = q.eq('status', f);
    const { data, error: e } = await q;
    busy.current = false; setLoading(false); setRefreshing(false);
    if (e) { setError(e.message); return; }
    setError(null);
    const got = (data || []) as Row[];
    setRows(prev => (reset ? got : [...prev, ...got]));
    setMore(got.length === PAGE);
  }, [biz, rows.length, filter]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useFocusEffect(useCallback(() => { load(true); loadCounts(); }, [biz?.id, filter]));

  if (!biz) return <Empty text="Please log in with your business account." />;
  if (error && !rows.length) return <ErrorView message={error} onRetry={() => load(true)} />;

  const label = (st: string) => (S as Record<string, unknown>)['status_' + st] as string || st;
  const chips: Filter[] = ['new', 'confirmed', 'delivered', 'cancelled', 'all'];

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: space, paddingBottom: 48 }}
      data={rows}
      keyExtractor={r => r.id}
      refreshControl={<RefreshControl refreshing={refreshing} tintColor={accent} colors={[accent]} onRefresh={() => { setRefreshing(true); load(true); loadCounts(); }} />}
      onEndReachedThreshold={0.5}
      onEndReached={() => { if (more && !loading) load(false); }}
      ListHeaderComponent={
        <View style={{ marginBottom: 12, gap: 12 }}>
          <Text style={{ fontSize: 24, fontWeight: '800', color: colors.text }}>{biz.name}</Text>
          {!biz.active ? <Notice kind="error">This business is suspended: customers can't see your products right now.</Notice> : null}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {chips.map(c => {
              const on = c === filter;
              const n = c === 'all' ? Object.values(counts).reduce((a, b) => a + b, 0) : counts[c] ?? 0;
              return (
                <Pressable key={c} onPress={() => { setFilter(c); setLoading(true); setRows([]); load(true, c); }}
                  style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: on ? accent : colors.line, backgroundColor: on ? accent : colors.surface }}>
                  <Text style={{ color: on ? '#fff' : colors.text, fontWeight: '700' }}>{c === 'all' ? 'All' : label(c)} · {n}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      }
      renderItem={({ item }) => {
        const sc = statusColors[item.status] || statusColors.new;
        return (
          <Pressable onPress={() => router.push({ pathname: '/biz-orders/[id]', params: { id: item.id } })}
            style={({ pressed }) => [{ backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: 14, marginBottom: 10, gap: 6 }, pressed && { opacity: 0.85 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontWeight: '800', color: colors.text, flex: 1 }} numberOfLines={1}>{item.first_name} {item.last_name}</Text>
              <Tag text={label(item.status)} bg={sc.bg} fg={sc.fg} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: colors.muted }}>{item.order_code} · {fmtDate(item.created_at)}</Text>
              <Text style={{ fontWeight: '800', color: accent }}>{money(item.total, S.currency)}</Text>
            </View>
          </Pressable>
        );
      }}
      ListEmptyComponent={loading ? <ActivityIndicator color={accent} style={{ marginTop: 40 }} /> : <Empty text="No orders here yet." />}
      ListFooterComponent={more && rows.length ? <ActivityIndicator color={accent} style={{ marginVertical: 16 }} /> : undefined}
    />
  );
}
