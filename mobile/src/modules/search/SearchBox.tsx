import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSettings } from '@/core/settings';
import { Img, ModeTag } from '@/core/ui';
import { money } from '@/core/format';
import { colors, radius } from '@/core/theme';
import type { HomeTopProps } from '../types';
import { addRecent, clearRecent, getRecent } from './engine';
import { useSuggestions } from './useSuggestions';
import { Highlight } from './Highlight';

/** Home-screen search bar with live suggestions. Plugged into the home screen by the module registry. */
export function SearchBox({ onActiveChange }: HomeTopProps) {
  const { S, accent } = useSettings();
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const { hits, loading, error } = useSuggestions(query);
  const active = focused || query.length > 0;

  useEffect(() => { onActiveChange(active); }, [active, onActiveChange]);
  useEffect(() => { if (focused) setRecent(getRecent()); }, [focused]);

  const openResults = (q: string) => {
    const t = q.trim();
    if (!t) return;
    addRecent(t);
    Keyboard.dismiss();
    router.push({ pathname: '/search', params: { q: t } });
  };
  const openProduct = (id: string) => {
    addRecent(query);
    Keyboard.dismiss();
    router.push({ pathname: '/product/[id]', params: { id } });
  };
  const cancel = () => { setQuery(''); setFocused(false); input.current?.blur(); Keyboard.dismiss(); };

  return (
    <View style={{ marginBottom: active ? 0 : 16 }}>
      <View style={s.barRow}>
        <View style={[s.bar, focused && { borderColor: accent }]}>
          <Ionicons name="search" size={20} color={colors.muted} />
          <TextInput
            ref={input}
            style={s.input}
            value={query}
            onChangeText={setQuery}
            placeholder={S.search_placeholder}
            placeholderTextColor={colors.muted}
            returnKeyType="search"
            onSubmitEditing={() => openResults(query)}
            onFocus={() => setFocused(true)}
            autoCorrect={false}
            autoCapitalize="none"
            accessibilityLabel={S.search_placeholder}
          />
          {loading ? <ActivityIndicator size="small" color={accent} /> : null}
          {query ? (
            <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityLabel="Clear search">
              <Ionicons name="close-circle" size={20} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>
        {active ? <Pressable onPress={cancel} hitSlop={8}><Text style={{ color: accent, fontWeight: '700' }}>Cancel</Text></Pressable> : null}
      </View>

      {active && !query && recent.length ? (
        <View style={s.panel}>
          <View style={s.panelHead}>
            <Text style={s.panelTitle}>{S.search_recent}</Text>
            <Pressable onPress={() => { clearRecent(); setRecent([]); }} hitSlop={8}><Text style={{ color: accent, fontWeight: '600' }}>Clear</Text></Pressable>
          </View>
          {recent.map(r => (
            <Pressable key={r} style={s.recent} onPress={() => { setQuery(r); openResults(r); }}>
              <Ionicons name="time-outline" size={18} color={colors.muted} />
              <Text style={{ flex: 1, color: colors.text, fontSize: 15 }} numberOfLines={1}>{r}</Text>
              <Ionicons name="arrow-up-outline" size={16} color={colors.muted} style={{ transform: [{ rotate: '-45deg' }] }} />
            </Pressable>
          ))}
        </View>
      ) : null}

      {query.trim() ? (
        <View style={s.panel}>
          {hits.map(h => (
            <Pressable key={h.id} style={({ pressed }) => [s.hit, pressed && { backgroundColor: colors.soft }]} onPress={() => openProduct(h.id)} accessibilityRole="button">
              <Img uri={h.image_url} label={h.name} style={s.thumb} />
              <View style={{ flex: 1, gap: 1 }}>
                <Highlight text={h.name} query={query} style={s.name} />
                {h.snippet ? <Text style={s.snippet} numberOfLines={1}>{h.snippet}</Text> : null}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[s.price, { color: accent }]}>{money(h.price, S.currency)}</Text>
                  <Text style={s.snippet} numberOfLines={1}>· {h.business_name}</Text>
                  <ModeTag mode={h.mode} />
                </View>
              </View>
            </Pressable>
          ))}
          {!loading && !hits.length ? (
            <Text style={s.empty}>{error ? 'Search is unavailable right now. Check your connection.' : S.search_no_results}</Text>
          ) : null}
          <Pressable style={s.viewAll} onPress={() => openResults(query)} accessibilityRole="button">
            <Text style={{ color: accent, fontWeight: '800', flex: 1 }} numberOfLines={1}>{S.search_view_all} “{query.trim()}”</Text>
            <Ionicons name="chevron-forward" size={18} color={accent} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bar: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.line, borderRadius: radius.pill, paddingHorizontal: 14, minHeight: 48 },
  input: { flex: 1, fontSize: 16, color: colors.text, paddingVertical: 10, minWidth: 0, ...({ outlineStyle: 'none' } as object) },
  panel: { marginTop: 10, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
  panelHead: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14, paddingTop: 12, paddingBottom: 4 },
  panelTitle: { fontWeight: '800', color: colors.text },
  recent: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  hit: { flexDirection: 'row', gap: 12, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderColor: colors.line, alignItems: 'center' },
  thumb: { width: 48, height: 48, borderRadius: 10 },
  name: { fontSize: 15, color: colors.text },
  snippet: { fontSize: 12, color: colors.muted, flexShrink: 1 },
  price: { fontSize: 13, fontWeight: '800' },
  empty: { padding: 16, color: colors.muted, textAlign: 'center' },
  viewAll: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 14, backgroundColor: '#fffaf5' },
});
