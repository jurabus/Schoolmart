import { useLocalSearchParams } from 'expo-router';
import { fetchOrder, isUuid } from '@/core/supabase';
import { useSettings } from '@/core/settings';
import { useQuery } from '@/core/useQuery';
import { Empty, ErrorView, Loading, OrderCard, Screen } from '@/core/ui';

/** One of the customer's own orders (the database only returns orders that belong to them). */
export function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { S } = useSettings();
  const q = useQuery(() => (isUuid(id) ? fetchOrder(id) : Promise.resolve(null)), [id]);

  if (q.loading) return <Loading />;
  if (q.error) return <ErrorView message={q.error} onRetry={q.reload} />;
  if (!q.data) return <Empty text={S.not_found_message} />;
  return <Screen onRefresh={q.reload}><OrderCard order={q.data.order} items={q.data.items} /></Screen>;
}
