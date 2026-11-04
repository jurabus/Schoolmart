import { useState, type ReactNode } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { BUSINESS_COLUMNS, sb, type Business, type Category } from '@/core/supabase';
import { useSettings } from '@/core/settings';
import { useQuery, unwrap } from '@/core/useQuery';
import { Empty, ErrorView, Img, Loading, Screen, TileGrid } from '@/core/ui';
import { safeUrl } from '@/core/format';
import { PRIVACY_URL } from '@/core/config';
import { colors, radius } from '@/core/theme';

/**
 * Home: optional top blocks from other modules (search bar), banner,
 * suppliers, then categories. While a top block is active (typing a search),
 * the rest of the page steps aside.
 */
export function HomeScreen({ renderTop }: { renderTop?: (onActiveChange: (a: boolean) => void) => ReactNode }) {
  const { S, accent, reload: reloadSettings } = useSettings();
  const [topActive, setTopActive] = useState(false);
  const q = useQuery(async () => {
    const [cats, biz] = await Promise.all([
      unwrap<Category[]>(sb.from('categories').select('id,title,image_url').eq('visible', true).order('sort_order').order('created_at')),
      unwrap<Business[]>(sb.from('businesses').select(BUSINESS_COLUMNS).eq('active', true).order('sort_order').order('created_at')),
    ]);
    return { cats, biz };
  }, []);
  const banner = safeUrl(S.banner_url);

  return (
    // onRefresh stays mounted while searching: swapping it out would rebuild the list and drop keyboard focus.
    <Screen onRefresh={() => (topActive ? Promise.resolve() : Promise.all([q.reload(), reloadSettings()]))}>
      {renderTop?.(setTopActive)}
      {topActive ? null : (
        <>
          <View style={[s.hero, { backgroundColor: accent }]}>
            {banner ? <Image source={{ uri: banner }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
            {banner ? <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.42)' }]} /> : null}
            <View style={s.heroInner}>
              {safeUrl(S.logo_url)
                ? <Image source={{ uri: safeUrl(S.logo_url) }} style={s.logo} contentFit="contain" accessibilityLabel={S.store_name} />
                : null}
              <Text style={s.heroTitle}>{S.hero_title}</Text>
              {S.hero_subtitle ? <Text style={s.heroSub}>{S.hero_subtitle}</Text> : null}
            </View>
          </View>

          {q.loading ? <Loading /> : q.error ? <ErrorView message={q.error} onRetry={q.reload} /> : (
            <>
              {q.data!.biz.length ? (
                <>
                  <Text style={s.section}>{S.suppliers_heading}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 8 }}>
                    {q.data!.biz.map(b => (
                      <Pressable key={b.id} style={({ pressed }) => [s.biz, pressed && { opacity: 0.85 }]}
                        onPress={() => router.push({ pathname: '/business/[id]', params: { id: b.id } })} accessibilityRole="button">
                        <Img uri={b.image_url} label={b.name} style={s.bizImg} />
                        <Text style={s.bizName} numberOfLines={2}>{b.name}</Text>
                        {b.address ? <Text style={s.bizSub} numberOfLines={1}>{b.address}</Text> : null}
                      </Pressable>
                    ))}
                  </ScrollView>
                </>
              ) : null}

              <Text style={s.section}>{S.categories_heading}</Text>
              {q.data!.cats.length ? (
                <TileGrid
                  items={q.data!.cats}
                  title={c => c.title}
                  image={c => c.image_url}
                  onPress={c => router.push({ pathname: '/category/[id]', params: { id: c.id } })}
                />
              ) : <Empty text={S.empty_list} />}
            </>
          )}

          <View style={s.footer}>
            {S.footer_text ? <Text style={s.footerText}>{S.footer_text}</Text> : null}
            {[S.contact_phone, S.contact_email, S.contact_address].filter(Boolean).length ? (
              <Text style={s.footerText}>{[S.contact_phone, S.contact_email, S.contact_address].filter(Boolean).join(' · ')}</Text>
            ) : null}
            <Text style={[s.footerText, { color: accent }]} onPress={() => Linking.openURL(PRIVACY_URL)} accessibilityRole="link">Privacy policy</Text>
          </View>
        </>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  hero: { borderRadius: radius.lg, overflow: 'hidden', minHeight: 200, justifyContent: 'center' },
  heroInner: { alignItems: 'center', padding: 24, gap: 6 },
  logo: { width: 200, height: 110 },
  heroTitle: { color: '#fff', fontSize: 26, fontWeight: '800', textAlign: 'center' },
  heroSub: { color: '#fff', opacity: 0.92, fontSize: 15, textAlign: 'center' },
  section: { fontSize: 21, fontWeight: '800', color: colors.text, marginTop: 24, marginBottom: 12 },
  biz: { width: 150, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
  bizImg: { width: '100%', height: 100 },
  bizName: { fontWeight: '800', color: colors.text, fontSize: 15, paddingHorizontal: 10, paddingTop: 8 },
  bizSub: { color: colors.muted, fontSize: 12, paddingHorizontal: 10, paddingBottom: 10, paddingTop: 2 },
  footer: { marginTop: 32, paddingTop: 16, borderTopWidth: 1, borderColor: colors.line, alignItems: 'center', gap: 6 },
  footerText: { color: colors.muted, fontSize: 13, textAlign: 'center' },
});
