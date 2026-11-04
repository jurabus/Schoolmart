import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { sb, type Mode } from '@/core/supabase';
import { useAuth } from '@/core/auth';
import { useSettings } from '@/core/settings';
import { Button, Empty, ErrorView, Img, ModeTag, Tag } from '@/core/ui';
import { money } from '@/core/format';
import { colors, radius, space } from '@/core/theme';

interface Row { id: string; name: string; price: number; mode: Mode; visible: boolean; image_url: string | null }
const PAGE = 30;

/** The business's own products, searchable and paginated. */
export function BizProductsScreen() {
  const { S, accent } = useSettings();
  const auth = useAuth();
  const biz = auth.account.business;
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [more, setMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const seq = useRef(0);

  const load = useCallback(async (reset: boolean) => {
    if (!biz || (busy.current && !reset)) return;
    const my = reset ? ++seq.current : seq.current;
    busy.current = true;
    const from = reset ? 0 : rows.length;
    let query = sb.from('products').select('id,name,price,mode,visible,image_url')
      .eq('business_id', biz.id).order('created_at', { ascending: false }).range(from, from + PAGE - 1);
    const term = q.trim().replace(/[%_\\]/g, m => '\\' + m);
    if (term) query = query.ilike('name', `%${term}%`);
    const { data, error: e } = await query;
    if (my !== seq.current) return;
    busy.current = false; setLoading(false); setRefreshing(false);
    if (e) { setError(e.message); return; }
    setError(null);
    const got = (data || []) as Row[];
    setRows(prev => (reset ? got : [...prev, ...got]));
    setMore(got.length === PAGE);
  }, [biz, rows.length, q]);

  // Re-query 250 ms after typing stops.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { const t = setTimeout(() => load(true), 250); return () => clearTimeout(t); }, [q]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useFocusEffect(useCallback(() => { load(true); }, [biz?.id]));

  if (!biz) return <Empty text="Please log in with your business account." />;
  if (error && !rows.length) return <ErrorView message={error} onRetry={() => load(true)} />;

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: space, paddingBottom: 48 }}
      data={rows}
      keyExtractor={r => r.id}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} tintColor={accent} colors={[accent]} onRefresh={() => { setRefreshing(true); load(true); }} />}
      onEndReachedThreshold={0.5}
      onEndReached={() => { if (more && !loading) load(false); }}
      ListHeaderComponent={
        <View style={{ gap: 12, marginBottom: 12 }}>
          <Button title="+ Add product" variant="primary" onPress={() => router.push('/biz-products/edit')} disabled={!biz.active} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.pill, paddingHorizontal: 14 }}>
            <Ionicons name="search" size={18} color={colors.muted} />
            <TextInput style={{ flex: 1, fontSize: 16, paddingVertical: 10, color: colors.text }} value={q} onChangeText={setQ}
              placeholder="Search your products" placeholderTextColor={colors.muted} autoCorrect={false} />
          </View>
        </View>
      }
      renderItem={({ item }) => (
        <Pressable onPress={() => router.push({ pathname: '/biz-products/edit', params: { id: item.id } })}
          style={({ pressed }) => [{ flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: 10, marginBottom: 8, opacity: item.visible ? 1 : 0.65 }, pressed && { opacity: 0.8 }]}>
          <Img uri={item.image_url} label={item.name} style={{ width: 56, height: 56, borderRadius: 10 }} />
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={{ fontWeight: '700', color: colors.text }} numberOfLines={2}>{item.name}</Text>
            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <Text style={{ color: accent, fontWeight: '800' }}>{money(item.price, S.currency)}</Text>
              <ModeTag mode={item.mode} />
              {!item.visible ? <Tag text="Hidden" bg={colors.offBg} fg={colors.offText} /> : null}
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </Pressable>
      )}
      ListEmptyComponent={loading ? <ActivityIndicator color={accent} style={{ marginTop: 40 }} /> : <Empty text={q ? 'No products match.' : 'No products yet. Add your first one.'} />}
      ListFooterComponent={more && rows.length ? <ActivityIndicator color={accent} style={{ marginVertical: 16 }} /> : undefined}
    />
  );
}
