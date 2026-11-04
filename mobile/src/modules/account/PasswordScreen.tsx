import { useState } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import { MIN_PASSWORD, useAuth } from '@/core/auth';
import { useSettings } from '@/core/settings';
import { Button, Card, Field, Notice, Screen } from '@/core/ui';

export function PasswordScreen() {
  const auth = useAuth();
  const { S } = useSettings();
  const [f, setF] = useState({ current: '', next: '', confirm: '' });
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF(x => ({ ...x, [k]: v }));

  async function save() {
    setErr('');
    if (f.next !== f.confirm) return setErr('New passwords do not match.');
    setBusy(true);
    const r = await auth.changePassword(f.current, f.next);
    setBusy(false);
    if (r.error) return setErr(r.error);
    setDone(true);
    setTimeout(() => router.back(), 1200);
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <Screen>
        <Card style={{ gap: 14 }}>
          <Field label="Current password" value={f.current} onChangeText={set('current')} secureTextEntry autoComplete="current-password" textContentType="password" />
          <Field label="New password" value={f.next} onChangeText={set('next')} secureTextEntry autoComplete="new-password" textContentType="newPassword" placeholder={`At least ${MIN_PASSWORD} characters`} />
          <Field label={S.f_confirm_password} value={f.confirm} onChangeText={set('confirm')} secureTextEntry autoComplete="new-password" textContentType="newPassword" />
          {err ? <Notice kind="error">{err}</Notice> : null}
          {done ? <Notice kind="info">Password changed.</Notice> : null}
          <Button title={S.change_password} variant="primary" loading={busy} onPress={save} />
        </Card>
      </Screen>
    </KeyboardAvoidingView>
  );
}
