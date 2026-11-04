import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect } from 'react';
import { isUuid, sb, type Subcategory } from '@/core/supabase';
import { useSettings } from '@/core/settings';
import { useQuery, unwrap } from '@/core/useQuery';
import { Empty, ErrorView, H1, Loading, Screen, TileGrid } from '@/core/ui';

export function CategoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { S } = useSettings();
  const nav = useNavigation();

  const q = useQuery(async () => {
    if (!isUuid(id)) return null;
    const [cat, subs] = await Promise.all([
      unwrap<{ id: string; title: string } | null>(sb.from('categories').select('id,title').eq('id', id).maybeSingle()),
      unwrap<Subcategory[]>(sb.from('subcategories').select('id,title,image_url,category_id')
        .eq('category_id', id).eq('visible', true).order('sort_order').order('created_at')),
    ]);
    return cat ? { cat, subs } : null;
  }, [id]);

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
          onPress={x => router.push({ pathname: '/subcategory/[id]', params: { id: x.id, title: x.title } })}
        />
      ) : <Empty text={S.empty_list} />}
    </Screen>
  );
}
