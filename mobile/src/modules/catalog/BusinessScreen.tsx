import { useEffect, useMemo } from 'react';
import { Text, View } from 'react-native';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { BUSINESS_COLUMNS, isUuid, sb, type Business } from '@/core/supabase';
import { useSettings } from '@/core/settings';
import { useQuery, unwrap } from '@/core/useQuery';
import { Card, Empty, ErrorView, Img, Loading, Muted, Screen, TileGrid, st } from '@/core/ui';
import { radius } from '@/core/theme';

interface Row {
  category_id: string; category_title: string; category_image: string | null;
  subcategory_id: string; subcategory_title: string; subcategory_image: string | null; product_count: number;
}

/** A supplier's store page: its profile, then the categories it sells in. */
export function BusinessScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { S } = useSettings();
  const nav = useNavigation();

  const q = useQuery(async () => {
    if (!isUuid(id)) return null;
    const [biz, rows] = await Promise.all([
      unwrap<Business | null>(sb.from('businesses').select(BUSINESS_COLUMNS).eq('id', id).eq('active', true).maybeSingle()),
      unwrap<Row[]>(sb.rpc('business_subcategories', { p_business: id })),
    ]);
    return biz ? { biz, rows } : null;
  }, [id]);

  useEffect(() => { if (q.data) nav.setOptions({ title: q.data.biz.name }); }, [q.data, nav]);

  const categories = useMemo(() => {
    const m = new Map<string, { id: string; title: string; image_url: string | null; count: number }>();
    for (const r of q.data?.rows || []) {
      const c = m.get(r.category_id) || { id: r.category_id, title: r.category_title, image_url: r.category_image, count: 0 };
      c.count += Number(r.product_count);
      m.set(r.category_id, c);
    }
    return [...m.values()];
  }, [q.data]);

  if (q.loading) return <Loading />;
  if (q.error) return <ErrorView message={q.error} onRetry={q.reload} />;
  if (!q.data) return <Empty text={S.not_found_page} />;
  const b = q.data.biz;

  return (
    <Screen onRefresh={q.reload}>
      <Card style={{ flexDirection: 'row', gap: 14, alignItems: 'center', marginBottom: 16 }}>
        <Img uri={b.image_url} label={b.name} style={{ width: 84, height: 84, borderRadius: radius.md }} />
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={[st.h1, { marginBottom: 0, fontSize: 22 }]}>{b.name}</Text>
          {b.address ? <Muted small left>{b.address}</Muted> : null}
          {b.contact_phone ? <Muted small left>{b.contact_phone}</Muted> : null}
        </View>
      </Card>
      {b.description ? <Text style={{ color: '#44403c', fontSize: 15, lineHeight: 21, marginBottom: 16 }}>{b.description}</Text> : null}
      {categories.length ? (
        <TileGrid
          items={categories}
          title={c => c.title}
          image={c => c.image_url}
          onPress={c => router.push({ pathname: '/category/[id]', params: { id: c.id, business: b.id } })}
          footer={c => <Muted small>{c.count} {c.count === 1 ? 'item' : 'items'}</Muted>}
        />
      ) : <Empty text={S.empty_list} />}
    </Screen>
  );
}
