import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect } from 'react';
import { isUuid, sb, type Subcategory } from '@/core/supabase';
import { useSettings } from '@/core/settings';
import { useQuery, unwrap } from '@/core/useQuery';
import { Empty, ErrorView, H1, Loading, Muted, Screen, TileGrid } from '@/core/ui';

/** Subcategories of a category. With ?business=<id>, only those that supplier sells in. */
export function CategoryScreen() {
  const { id, business } = useLocalSearchParams<{ id: string; business?: string }>();
  const { S } = useSettings();
  const nav = useNavigation();
  const biz = isUuid(business) ? business! : null;

  const q = useQuery(async () => {
    if (!isUuid(id)) return null;
    const cat = await unwrap<{ id: string; title: string } | null>(sb.from('categories').select('id,title').eq('id', id).maybeSingle());
    if (!cat) return null;
    let subs: (Subcategory & { count?: number })[];
    if (biz) {
      const rows = await unwrap<{ category_id: string; subcategory_id: string; subcategory_title: string; subcategory_image: string | null; product_count: number }[]>(
        sb.rpc('business_subcategories', { p_business: biz }));
      subs = rows.filter(r => r.category_id === id).map(r => ({
        id: r.subcategory_id, title: r.subcategory_title, image_url: r.subcategory_image, category_id: id, count: Number(r.product_count),
      }));
    } else {
      subs = await unwrap<Subcategory[]>(sb.from('subcategories').select('id,title,image_url,category_id')
        .eq('category_id', id).eq('visible', true).order('sort_order').order('created_at'));
    }
    return { cat, subs };
  }, [id, biz]);

  useEffect(() => { if (q.data) nav.setOptions({ title: q.data.cat.title }); }, [q.data, nav]);

  if (q.loading) return <Loading />;
  if (q.error) return <ErrorView message={q.error} onRetry={q.reload} />;
  if (!q.data) return <Empty text={S.not_found_page} />;

  return (
    <Screen onRefresh={q.reload}>
      <H1>{q.data.cat.title}</H1>
      {q.data.subs.length ? (
        <TileGrid
          items={q.data.subs}
          title={x => x.title}
          image={x => x.image_url}
          onPress={x => router.push({ pathname: '/subcategory/[id]', params: biz ? { id: x.id, business: biz } : { id: x.id } })}
          footer={x => (x.count ? <Muted small>{x.count} {x.count === 1 ? 'item' : 'items'}</Muted> : null)}
        />
      ) : <Empty text={S.empty_list} />}
    </Screen>
  );
}
