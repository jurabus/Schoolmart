import { useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { MIN_PASSWORD, useAuth } from '@/core/auth';
import { useSettings } from '@/core/settings';
import { PRIVACY_URL } from '@/core/config';
import { Button, Card, Field, Muted, Notice, Screen, st } from '@/core/ui';

/** Customer sign-up: name, phone, address, password. */
export function RegisterScreen() {
  const { next } = useLocalSearchParams<{ next?: string }>();
  const auth = useAuth();
  const { S, accent } = useSettings();
  const [f, setF] = useState({ first: '', last: '', phone: '', address: '', password: '', confirm: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF(x => ({ ...x, [k]: v }));

  async function submit() {
    setErr('');
    if (f.password !== f.confirm) return setErr('Passwords do not match.');
    setBusy(true);
    const r = await auth.signUp({ firstName: f.first, lastName: f.last, phone: f.phone, address: f.address, password: f.password });
    setBusy(false);
    if (r.error) return setErr(r.error);
    if (next && /^\/[a-z0-9/_-]*$/i.test(next)) router.replace(next as never);
    else router.replace('/account');
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <Screen>
        <Card style={{ gap: 14 }}>
          <Text style={[st.h1, { marginBottom: 0 }]}>{S.register_title}</Text>
          <Field label={S.f_first_name} value={f.first} onChangeText={set('first')} maxLength={60} autoComplete="given-name" textContentType="givenName" />
          <Field label={S.f_last_name} value={f.last} onChangeText={set('last')} maxLength={60} autoComplete="family-name" textContentType="familyName" />
          <Field label={S.f_phone} value={f.phone} onChangeText={set('phone')} keyboardType="phone-pad" maxLength={20} autoComplete="tel" textContentType="telephoneNumber" />
          <Field label={S.f_address} value={f.address} onChangeText={set('address')} maxLength={500} multiline autoComplete="street-address" textContentType="fullStreetAddress" />
          <Field label={S.f_password} value={f.password} onChangeText={set('password')} secureTextEntry autoComplete="new-password" textContentType="newPassword" placeholder={`At least ${MIN_PASSWORD} characters`} />
          <Field label={S.f_confirm_password} value={f.confirm} onChangeText={set('confirm')} secureTextEntry autoComplete="new-password" textContentType="newPassword" />
          {err ? <Notice kind="error">{err}</Notice> : null}
          <Button title={S.register_button} variant="primary" loading={busy} onPress={submit} />
          <Muted small>
            Your phone number is your login and can't be changed later. By creating an account you agree to our{' '}
            <Text style={{ color: accent }} onPress={() => Linking.openURL(PRIVACY_URL)}>privacy policy</Text>.
          </Muted>
          <Button title={`${S.login_title} instead`} onPress={() => router.replace({ pathname: '/account/login', params: next ? { next } : {} })} />
        </Card>
      </Screen>
    </KeyboardAvoidingView>
  );
}
