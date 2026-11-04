import { router } from 'expo-router';
import { useSettings } from '@/core/settings';
import { Button, Empty } from '@/core/ui';

export default function NotFound() {
  const { S } = useSettings();
  return <Empty text={S.not_found_page} action={<Button title={S.lbl_home} variant="primary" style={{ marginTop: 16 }} onPress={() => router.replace('/')} />} />;
}
