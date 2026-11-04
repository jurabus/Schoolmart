import { useState } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/core/auth';
import { useSettings } from '@/core/settings';
import { displayPhone } from '@/core/phone';
import { Button, Card, Empty, Field, Muted, Notice, Screen } from '@/core/ui';

export function EditProfileScreen() {
  const auth = useAuth();
  const { S } = useSettings();
  const c = auth.account.customer;
  const [f, setF] = useState({ first: c?.first_name || '', last: c?.last_name || '', address: c?.address || '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF(x => ({ ...x, [k]: v }));

  if (!c) return <Empty text="Please log in again." />;

  async function save() {
    setErr(''); setBusy(true);
    const r = await auth.updateProfile({ firstName: f.first, lastName: f.last, address: f.address });
    setBusy(false);
    if (r.error) return setErr(r.error);
    router.back();
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <Screen>
        <Card style={{ gap: 14 }}>
          <Field label={S.f_first_name} value={f.first} onChangeText={set('first')} maxLength={60} />
          <Field label={S.f_last_name} value={f.last} onChangeText={set('last')} maxLength={60} />
          <Field label={S.f_phone} value={displayPhone(c.phone)} editable={false} />
          <Muted small left>Your phone number is your login and can't be changed.</Muted>
          <Field label={S.f_address} value={f.address} onChangeText={set('address')} maxLength={500} multiline />
          {err ? <Notice kind="error">{err}</Notice> : null}
          <Button title="Save" variant="primary" loading={busy} onPress={save} />
        </Card>
      </Screen>
    </KeyboardAvoidingView>
  );
}
