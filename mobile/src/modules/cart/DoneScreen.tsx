import { useState } from 'react';
import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { lookupOrder } from '@/core/supabase';
import { useSettings } from '@/core/settings';
import { useQuery } from '@/core/useQuery';
import { Button, Card, Muted, OrderCard, Screen, st } from '@/core/ui';
import { colors } from '@/core/theme';

export function DoneScreen() {
  const { code = '', phone = '' } = useLocalSearchParams<{ code: string; phone: string }>();
  const { S, accent } = useSettings();
  const [copied, setCopied] = useState(false);
  const q = useQuery(() => lookupOrder(phone, code), [phone, code]);

  return (
    <Screen>
      <Card style={{ alignItems: 'center', gap: 10, paddingVertical: 28 }}>
        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.okBg, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: colors.ok, fontSize: 32, fontWeight: '800' }}>✓</Text>
        </View>
        <Text style={[st.h1, { textAlign: 'center', marginBottom: 0 }]}>{S.confirm_title}</Text>
        <Muted>{S.confirm_message}</Muted>
        <Muted small>{S.your_order_code}</Muted>
        <Text selectable style={[st.code, { color: accent, fontSize: 32 }]}>{code}</Text>
        <Button
          title={copied ? `✓ ${S.copied}` : S.copy_code}
          onPress={async () => { await Clipboard.setStringAsync(code); setCopied(true); }}
          style={{ alignSelf: 'stretch' }}
        />
        <Button title={S.my_orders_title} onPress={() => router.navigate('/track')} style={{ alignSelf: 'stretch' }} />
        <Button title={S.continue_shopping} variant="primary" onPress={() => router.navigate('/')} style={{ alignSelf: 'stretch' }} />
      </Card>
      {q.data?.order ? <View style={{ marginTop: 16 }}><OrderCard order={q.data.order} items={q.data.items} /></View> : null}
    </Screen>
  );
}
