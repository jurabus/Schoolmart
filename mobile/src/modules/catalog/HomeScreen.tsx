import { Linking, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { sb, type Category } from '@/core/supabase';
import { useSettings } from '@/core/settings';
import { useQuery, unwrap } from '@/core/useQuery';
import { Empty, ErrorView, Img, Loading, Screen, TileGrid } from '@/core/ui';
import { safeUrl } from '@/core/format';
import { PRIVACY_URL } from '@/core/config';
import { colors, radius } from '@/core/theme';

export function HomeScreen() {
  const { S, accent, reload: reloadSettings } = useSettings();
  const q = useQuery(() => unwrap<Category[]>(
    sb.from('categories').select('id,title,image_url').eq('visible', true).order('sort_order').order('created_at'),
  ), []);
  const banner = safeUrl(S.banner_url);

  return (
    <Screen onRefresh={() => Promise.all([q.reload(), reloadSettings()])}>
      <View style={[s.hero, { backgroundColor: accent }]}>
        {banner ? <Image source={{ uri: banner }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
        {banner ? <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.42)' }]} /> : null}
        <View style={s.heroInner}>
          {safeUrl(S.logo_url)
            ? <Image source={{ uri: safeUrl(S.logo_url) }} style={s.logo} contentFit="contain" accessibilityLabel={S.store_name} />
            : <Img uri={null} label={S.store_name} style={s.logoPh} />}
          <Text style={s.heroTitle}>{S.hero_title}</Text>
          {S.hero_subtitle ? <Text style={s.heroSub}>{S.hero_subtitle}</Text> : null}
        </View>
      </View>

      <Text style={s.section}>{S.categories_heading}</Text>
      {q.loading ? <Loading /> : q.error ? <ErrorView message={q.error} onRetry={q.reload} /> : !q.data?.length ? (
        <Empty text={S.empty_list} />
      ) : (
        <TileGrid
          items={q.data}
          title={c => c.title}
          image={c => c.image_url}
          onPress={c => router.push({ pathname: '/category/[id]', params: { id: c.id, title: c.title } })}
        />
      )}

      <View style={s.footer}>
        {S.footer_text ? <Text style={s.footerText}>{S.footer_text}</Text> : null}
        {[S.contact_phone, S.contact_email, S.contact_address].filter(Boolean).length ? (
          <Text style={s.footerText}>{[S.contact_phone, S.contact_email, S.contact_address].filter(Boolean).join(' · ')}</Text>
        ) : null}
        <Text style={[s.footerText, { color: accent }]} onPress={() => Linking.openURL(PRIVACY_URL)} accessibilityRole="link">Privacy policy</Text>
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  hero: { borderRadius: radius.lg, overflow: 'hidden', minHeight: 300, justifyContent: 'center' },
  heroInner: { alignItems: 'center', padding: 28, gap: 8 },
  logo: { width: 220, height: 150 },
  logoPh: { width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.2)' },
  heroTitle: { color: '#fff', fontSize: 28, fontWeight: '800', textAlign: 'center' },
  heroSub: { color: '#fff', opacity: 0.92, fontSize: 16, textAlign: 'center' },
  section: { fontSize: 22, fontWeight: '800', color: colors.text, marginTop: 24, marginBottom: 14 },
  footer: { marginTop: 32, paddingTop: 16, borderTopWidth: 1, borderColor: colors.line, alignItems: 'center', gap: 6 },
  footerText: { color: colors.muted, fontSize: 13, textAlign: 'center' },
});
