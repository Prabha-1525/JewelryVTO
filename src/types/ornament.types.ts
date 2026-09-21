import type { ImageSourcePropType } from 'react-native';

export type OrnamentCategory = 'earrings' | 'necklaces';

export type OrnamentOffset = {
  x: number;
  y: number;
};

export type Ornament = {
  id: string;
  name: string;
  category: OrnamentCategory;
  price: number;
  description: string;
  productImage: ImageSourcePropType;
  glbAsset: number;
  previewGlbAsset?: number;
  scale: number;
  offset: OrnamentOffset;
  forwardOffset: number;
};

export type CategoryInfo = {
  id: OrnamentCategory;
  title: string;
  subtitle: string;
};
