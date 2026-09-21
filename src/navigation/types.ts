import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OrnamentCategory } from '../types';

export type RootStackParamList = {
  Home: undefined;
  OrnamentList: { category: OrnamentCategory };
  TryOn: { ornamentId: string };
};

export type HomeScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'Home'
>;
export type OrnamentListScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'OrnamentList'
>;
export type TryOnScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'TryOn'
>;
