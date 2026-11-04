import { useState } from 'react';
import { Linking, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { fetchOrder, friendlyError, isUuid, sb, type OrderStatus } from '@/core/supabase';
import { useSettings } from '@/core/settings';
import { useConfirm } from '@/core/confirm';
import { useQuery } from '@/core/useQuery';
import { Button, Card, Empty, ErrorView, Loading, Notice, OrderCard, Screen } from '@/core/ui';

/** Order details for the business, with the status actions it may take. */
export function BizOrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { S } = useSettings();
  const confirm = useConfirm();
  const [busy, setBusy] = useState<OrderStatus | null>(null);
  const [err, setErr] = useState('');
  const q = useQuery(() => (isUuid(id) ? fetchOrder(id) : Promise.resolve(null)), [id]);

  if (q.loading) return <Loading />;
  if (q.error) return <ErrorView message={q.error} onRetry={q.reload} />;
  if (!q.data) return <Empty text={S.not_found_message} />;
  const o = q.data.order;
  const label = (st: string) => (S as Record<string, unknown>)['status_' + st] as string || st;

  async function setStatus(st: OrderStatus) {
    setErr('');
    if (st === 'cancelled' && !(await confirm({ title: 'Cancel this order?', message: `Order ${o.order_code} will be marked as cancelled.`, confirmText: 'Cancel order', cancelText: 'Keep', destructive: true }))) return;
    setBusy(st);
    const { error } = await sb.rpc('business_set_order_status', { p_order: id, p_status: st });
    setBusy(null);
    if (error) return setErr(friendlyError(error.message));
    q.reload();
  }

  const actions: { st: OrderStatus; title: string; primary?: boolean }[] =
    o.status === 'new' ? [{ st: 'confirmed', title: `Mark as ${label('confirmed')}`, primary: true }, { st: 'cancelled', title: 'Cancel order' }]
    : o.status === 'confirmed' ? [{ st: 'delivered', title: `Mark as ${label('delivered')}`, primary: true }, { st: 'cancelled', title: 'Cancel order' }]
    : [{ st: 'new', title: `Re-open as ${label('new')}` }];

  return (
    <Screen onRefresh={q.reload}>
      <OrderCard order={o} items={q.data.items} />
      <Card style={{ marginTop: 16, gap: 10 }}>
        <Button title={`Call ${o.first_name}`} onPress={() => Linking.openURL(`tel:+${o.phone.replace(/\D/g, '')}`)} />
        {actions.map(a => (
          <Button key={a.st} title={a.title} variant={a.primary ? 'primary' : a.st === 'cancelled' ? 'danger' : 'default'}
            loading={busy === a.st} disabled={!!busy && busy !== a.st} onPress={() => setStatus(a.st)} />
        ))}
        {err ? <View><Notice kind="error">{err}</Notice></View> : null}
      </Card>
    </Screen>
  );
}
