import { useState } from 'react';
import { Linking, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/core/auth';
import { useSettings } from '@/core/settings';
import { useConfirm } from '@/core/confirm';
import { displayPhone } from '@/core/phone';
import { PRIVACY_URL } from '@/core/config';
import { Button, Card, Img, ListRow, Loading, Muted, Notice, Screen, st } from '@/core/ui';
import { colors, radius } from '@/core/theme';

export function AccountScreen() {
  const auth = useAuth();
  const { S } = useSettings();
  const confirm = useConfirm();
  const [err, setErr] = useState('');

  if (auth.loading) return <Loading />;

  if (auth.role === 'guest') {
    return (
      <Screen>
        <Card style={{ gap: 12, paddingVertical: 24 }}>
          <Text style={[st.h1, { marginBottom: 0 }]}>{S.nav_account}</Text>
          <Muted left>Log in to check out faster, keep your address saved and see all your orders.</Muted>
          <Button title={S.login_button} variant="primary" onPress={() => router.push('/account/login')} />
          <Button title={S.register_button} onPress={() => router.push('/account/register')} />
        </Card>
        <Card style={{ marginTop: 16, paddingVertical: 4 }}>
          <ListRow title="Privacy policy" icon="shield-checkmark-outline" onPress={() => Linking.openURL(PRIVACY_URL)} />
        </Card>
      </Screen>
    );
  }

  const logout = async () => { await auth.signOut(); router.replace('/'); };

  if (auth.role === 'business' && auth.account.business) {
    const b = auth.account.business;
    return (
      <Screen>
        <Card style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
          <Img uri={b.image_url} label={b.name} style={{ width: 72, height: 72, borderRadius: radius.md }} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[st.h1, { marginBottom: 0, fontSize: 20 }]}>{b.name}</Text>
            <Muted small left>Business account</Muted>
            {b.address ? <Muted small left>{b.address}</Muted> : null}
          </View>
        </Card>
        {!b.active ? <View style={{ marginTop: 12 }}><Notice kind="error">This business is currently suspended. Contact SchoolMart.</Notice></View> : null}
        <Card style={{ marginTop: 16, paddingVertical: 4 }}>
          <ListRow title={S.change_password} icon="key-outline" onPress={() => router.push('/account/password')} />
          <ListRow title={S.logout} icon="log-out-outline" onPress={logout} />
        </Card>
        <View style={{ marginTop: 12 }}><Muted small>To change your business name, photo or details, contact SchoolMart.</Muted></View>
      </Screen>
    );
  }

  if (auth.role === 'customer' && auth.account.customer) {
    const c = auth.account.customer;
    const del = async () => {
      setErr('');
      const yes = await confirm({ title: `${S.delete_account}?`, message: S.delete_account_confirm, confirmText: S.delete_account, destructive: true });
      if (!yes) return;
      const r = await auth.deleteAccount();
      if (r.error) setErr(r.error); else router.replace('/');
    };
    return (
      <Screen>
        <Card style={{ gap: 4 }}>
          <Text style={[st.h1, { marginBottom: 4, fontSize: 22 }]}>{c.first_name} {c.last_name}</Text>
          <Text style={{ color: colors.text }}>{displayPhone(c.phone)}</Text>
          <Muted small left>{c.address}</Muted>
        </Card>
        <Card style={{ marginTop: 16, paddingVertical: 4 }}>
          <ListRow title={S.my_orders_title} icon="receipt-outline" onPress={() => router.navigate('/track')} />
          <ListRow title={S.edit_profile} icon="create-outline" onPress={() => router.push('/account/edit')} />
          <ListRow title={S.change_password} icon="key-outline" onPress={() => router.push('/account/password')} />
          <ListRow title="Privacy policy" icon="shield-checkmark-outline" onPress={() => Linking.openURL(PRIVACY_URL)} />
          <ListRow title={S.logout} icon="log-out-outline" onPress={logout} />
        </Card>
        {err ? <View style={{ marginTop: 12 }}><Notice kind="error">{err}</Notice></View> : null}
        <Card style={{ marginTop: 16, paddingVertical: 4 }}>
          <ListRow title={S.delete_account} icon="trash-outline" danger onPress={del} />
        </Card>
      </Screen>
    );
  }

  // admin or an account without a profile
  return (
    <Screen>
      <Card style={{ gap: 12 }}>
        <Text style={[st.h1, { marginBottom: 0, fontSize: 20 }]}>{S.nav_account}</Text>
        <Muted left>
          {auth.role === 'admin'
            ? 'This is an admin account. Manage the store from the website admin panel.'
            : 'This login has no customer profile. Log out and create a customer account.'}
        </Muted>
        <Button title={S.logout} onPress={logout} />
      </Card>
    </Screen>
  );
}
