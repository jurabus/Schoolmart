import type { AppModule } from '../types';
import { SearchBox } from './SearchBox';

export const searchModule: AppModule = {
  id: 'search',
  HomeTop: SearchBox,
};

export { ResultsScreen } from './ResultsScreen';
