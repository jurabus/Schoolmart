import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/core/auth';
import { useSettings } from '@/core/settings';
import { Button, Card, Field, Muted, Notice, Screen, st } from '@/core/ui';

/** Phone + password login for customers and businesses. */
export function LoginScreen() {
  const { next } = useLocalSearchParams<{ next?: string }>();
  const auth = useAuth();
  const { S } = useSettings();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setErr(''); setBusy(true);
    const r = await auth.signIn(phone, password);
    setBusy(false);
    if (r.error) return setErr(r.error);
    // Only follow in-app paths.
    if (next && /^\/[a-z0-9/_-]*$/i.test(next)) router.replace(next as never);
    else if (router.canGoBack()) router.back();
    else router.replace('/account');
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <Screen>
        <Card style={{ gap: 14 }}>
          <Text style={[st.h1, { marginBottom: 0 }]}>{S.login_title}</Text>
          <Field label={S.f_phone} value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" maxLength={20} />
          <Field label={S.f_password} value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" textContentType="password" onSubmitEditing={submit} />
          {err ? <Notice kind="error">{err}</Notice> : null}
          <Button title={S.login_button} variant="primary" loading={busy} onPress={submit} />
          <Muted>New here?</Muted>
          <Button title={S.register_button} onPress={() => router.replace({ pathname: '/account/register', params: next ? { next } : {} })} />
        </Card>
      </Screen>
    </KeyboardAvoidingView>
  );
}
