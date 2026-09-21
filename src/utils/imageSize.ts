import { Image, type ImageSourcePropType } from 'react-native';

export function getImageSize(source: ImageSourcePropType): {
  width: number;
  height: number;
} {
  const resolved = Image.resolveAssetSource(source);
  return {
    width: resolved?.width ?? 1,
    height: resolved?.height ?? 1,
  };
}
