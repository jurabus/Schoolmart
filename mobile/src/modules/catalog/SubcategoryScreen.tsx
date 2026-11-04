import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect } from 'react';
import { Text, View } from 'react-native';
import { isUuid, sb, type Product } from '@/core/supabase';
import { useSettings } from '@/core/settings';
import { useQuery, unwrap } from '@/core/useQuery';
import { Empty, ErrorView, H1, Loading, ModeTag, Screen, TileGrid } from '@/core/ui';
import { money } from '@/core/format';

export function SubcategoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { S, accent } = useSettings();
  const nav = useNavigation();

  const q = useQuery(async () => {
    if (!isUuid(id)) return null;
    const [sub, products] = await Promise.all([
      unwrap<{ id: string; title: string } | null>(sb.from('subcategories').select('id,title').eq('id', id).maybeSingle()),
      unwrap<Product[]>(sb.from('products').select('id,name,description,image_url,price,mode')
        .eq('subcategory_id', id).eq('visible', true).order('sort_order').order('created_at')),
    ]);
    return sub ? { sub, products } : null;
  }, [id]);

  useEffect(() => { if (q.data) nav.setOptions({ title: q.data.sub.title }); }, [q.data, nav]);

  if (q.loading) return <Loading />;
  if (q.error) return <ErrorView message={q.error} onRetry={q.reload} />;
  if (!q.data) return <Empty text={S.not_found_page} />;

  return (
    <Screen onRefresh={q.reload}>
      <H1>{q.data.sub.title}</H1>
      {q.data.products.length ? (
        <TileGrid
          items={q.data.products}
          title={p => p.name}
          image={p => p.image_url}
          onPress={p => router.push({ pathname: '/product/[id]', params: { id: p.id } })}
          footer={p => (
            <View style={{ alignItems: 'center', gap: 4, marginTop: 4 }}>
              <Text style={{ color: accent, fontWeight: '800' }}>{money(p.price, S.currency)}</Text>
              <ModeTag mode={p.mode} />
            </View>
          )}
        />
      ) : <Empty text={S.empty_list} />}
    </Screen>
  );
}
