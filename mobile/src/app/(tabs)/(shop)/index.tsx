import { useSettings } from '@/core/settings';
import { HomeScreen } from '@/modules/catalog';
import { homeTops } from '@/modules/registry';

export default function Home() {
  const { S } = useSettings();
  const tops = homeTops(S.app_disabled_modules);
  return (
    <HomeScreen
      renderTop={onActiveChange => tops.map(({ id, Component }) => <Component key={id} onActiveChange={onActiveChange} />)}
    />
  );
}
