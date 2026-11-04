import { useCallback, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { lookupOrder, type LookupResult } from '@/core/supabase';
import { useSettings } from '@/core/settings';
import { getRecentOrders, removeRecentOrder, type RecentOrder } from '@/core/recentOrders';
import { Button, Card, Field, H1, Muted, Notice, OrderCard, Screen, st } from '@/core/ui';
import { fmtDate } from '@/core/format';
import { colors } from '@/core/theme';

export function TrackScreen({ header }: { header?: ReactNode } = {}) {
  const { S, accent } = useSettings();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [result, setResult] = useState<LookupResult | null>(null);
  const [recent, setRecent] = useState<RecentOrder[]>([]);

  useFocusEffect(useCallback(() => { setRecent(getRecentOrders()); }, []));

  async function find(p: string, c: string) {
    setErr(''); setResult(null);
    if (!p.trim() || !c.trim()) return setErr(S.err_required);
    setBusy(true);
    const r = await lookupOrder(p.trim(), c.trim());
    setBusy(false);
    if (r.error === 'rate_limited') return setErr(S.rate_limited_message);
    if (r.error || !r.order) return setErr(S.not_found_message);
    setResult(r);
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <Screen>
        {header}
        <H1>{S.track_title}</H1>

        {recent.length ? (
          <Card style={{ marginBottom: 16, paddingVertical: 4 }}>
            {recent.map((o, i) => (
              <View key={o.code} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderColor: colors.line }}>
                <Pressable style={{ flex: 1 }} onPress={() => { setPhone(o.phone); setCode(o.code); find(o.phone, o.code); }}>
                  <Text style={[st.code, { color: accent, fontSize: 16 }]}>{o.code}</Text>
                  <Text style={{ color: colors.muted, fontSize: 13 }}>{fmtDate(o.at)}</Text>
                </Pressable>
                <Pressable hitSlop={10} accessibilityLabel="Remove from this device" onPress={() => { removeRecentOrder(o.code); setRecent(getRecentOrders()); }}>
                  <Ionicons name="trash-outline" size={18} color={colors.muted} />
                </Pressable>
              </View>
            ))}
          </Card>
        ) : null}

        <Card style={{ gap: 14 }}>
          <Muted left>{S.track_help}</Muted>
          <Field label={S.f_phone} value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={20} autoComplete="tel" />
          <Field label={S.f_order_code} value={code} onChangeText={t => setCode(t.toUpperCase())} autoCapitalize="characters" autoCorrect={false} maxLength={12} placeholder="XXXX-XXXX" />
          {err ? <Notice kind="error">{err}</Notice> : null}
          <Button title={S.track_button} variant="primary" loading={busy} onPress={() => find(phone, code)} />
        </Card>

        {result?.order ? <View style={{ marginTop: 16 }}><OrderCard order={result.order} items={result.items} /></View> : null}
      </Screen>
    </KeyboardAvoidingView>
  );
}
