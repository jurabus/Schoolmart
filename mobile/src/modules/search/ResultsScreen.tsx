import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSettings } from '@/core/settings';
import { Button, Img, ModeTag } from '@/core/ui';
import { money } from '@/core/format';
import { colors, radius, space } from '@/core/theme';
import { addRecent, PAGE_SIZE, searchProducts, type SearchHit } from './engine';
import { Highlight } from './Highlight';

const ROW_HEIGHT = 104;

/**
 * Full results with infinite scroll: 20 items per page, loaded as you approach the end.
 * The list is virtualized, so only rows near the screen are kept in memory.
 */
export function ResultsScreen() {
  const params = useLocalSearchParams<{ q: string }>();
  const { S, accent } = useSettings();
  const nav = useNavigation();
  const [query, setQuery] = useState(String(params.q || ''));
  const [draft, setDraft] = useState(String(params.q || ''));
  const [items, setItems] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(true);
  const [error, setError] = useState(false);
  const seq = useRef(0);
  const busy = useRef(false);

  useEffect(() => { nav.setOptions({ title: query ? `“${query}”` : 'Search' }); }, [query, nav]);

  const loadPage = useCallback(async (reset: boolean) => {
    if (busy.current && !reset) return;
    const my = reset ? ++seq.current : seq.current;
    busy.current = true;
    if (reset) { setItems([]); setMore(true); setError(false); setLoading(true); }
    try {
      const offset = reset ? 0 : items.length;
      const rows = await searchProducts(query, PAGE_SIZE, offset);
      if (my !== seq.current) return;
      setItems(prev => (reset ? rows : [...prev, ...rows.filter(r => !prev.some(p => p.id === r.id))]));
      setMore(rows.length === PAGE_SIZE && offset + rows.length < 1000);
    } catch {
      if (my === seq.current) setError(true);
    } finally {
      if (my === seq.current) { setLoading(false); busy.current = false; }
    }
  }, [query, items.length]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadPage(true); }, [query]);

  const submit = () => {
    const t = draft.trim();
    if (!t || t === query) return;
    addRecent(t);
    setQuery(t);
    router.setParams({ q: t });
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={s.barWrap}>
        <View style={s.bar}>
          <Ionicons name="search" size={18} color={colors.muted} />
          <TextInput style={s.input} value={draft} onChangeText={setDraft} onSubmitEditing={submit} returnKeyType="search"
            placeholder={S.search_placeholder} placeholderTextColor={colors.muted} autoCorrect={false} autoCapitalize="none" />
          {draft ? <Pressable onPress={() => setDraft('')} hitSlop={10}><Ionicons name="close-circle" size={18} color={colors.muted} /></Pressable> : null}
        </View>
      </View>
      <FlatList
        data={items}
        keyExtractor={i => i.id}
        contentContainerStyle={{ padding: space, paddingTop: 4, paddingBottom: 48 }}
        getItemLayout={(_, index) => ({ length: ROW_HEIGHT, offset: ROW_HEIGHT * index, index })}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={7}
        removeClippedSubviews
        onEndReachedThreshold={0.6}
        onEndReached={() => { if (more && !loading && !error && items.length) loadPage(false); }}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <Pressable style={({ pressed }) => [s.row, pressed && { opacity: 0.85 }]} onPress={() => router.push({ pathname: '/product/[id]', params: { id: item.id } })}>
            <Img uri={item.image_url} label={item.name} style={s.img} />
            <View style={{ flex: 1, gap: 3 }}>
              <Highlight text={item.name} query={query} style={s.name} lines={2} />
              {item.snippet ? <Text style={s.snippet} numberOfLines={1}>{item.snippet}</Text> : null}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={[s.price, { color: accent }]}>{money(item.price, S.currency)}</Text>
                <ModeTag mode={item.mode} />
              </View>
              <Text style={s.snippet} numberOfLines={1}>{S.supplier_label} {item.business_name}</Text>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={loading ? undefined : (
          <View style={s.empty}>
            <Text style={{ color: colors.muted, textAlign: 'center' }}>{error ? 'Search is unavailable right now. Check your connection.' : S.search_no_results}</Text>
            {error ? <Button title="Try again" onPress={() => loadPage(true)} style={{ marginTop: 12 }} /> : null}
          </View>
        )}
        ListFooterComponent={loading || (more && items.length) ? <ActivityIndicator color={accent} style={{ marginVertical: 20 }} /> : undefined}
      />
    </View>
  );
}

const s = StyleSheet.create({
  barWrap: { padding: space, paddingBottom: 8, backgroundColor: colors.bg },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.pill, paddingHorizontal: 14, minHeight: 44 },
  input: { flex: 1, fontSize: 16, color: colors.text, paddingVertical: 8, minWidth: 0, ...({ outlineStyle: 'none' } as object) },
  row: { height: ROW_HEIGHT - 8, marginBottom: 8, flexDirection: 'row', gap: 12, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: 10, alignItems: 'center' },
  img: { width: 76, height: 76, borderRadius: 12 },
  name: { fontSize: 15, color: colors.text, fontWeight: '600' },
  snippet: { fontSize: 12, color: colors.muted },
  price: { fontSize: 15, fontWeight: '800' },
  empty: { padding: 32, alignItems: 'center' },
});
