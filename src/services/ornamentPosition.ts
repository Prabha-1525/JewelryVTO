import type {
  FaceLandmarks,
  Ornament,
  OverlayPlacement,
  Size2D,
} from '../types';
import { getImageSize } from '../utils';
import { isVisibleEar } from './faceLandmarker';

function toPixels(normalized: number, size: number): number {
  return normalized * size;
}

export function getOrnamentPlacements(
  ornament: Ornament,
  previewSize: Size2D,
  landmarks: FaceLandmarks | null = null,
): OverlayPlacement[] {
  if (
    previewSize.width <= 0 ||
    previewSize.height <= 0 ||
    landmarks == null ||
    landmarks.faceWidth <= 0.04
  ) {
    return [];
  }

  const { width: imageWidth, height: imageHeight } = getImageSize(
    ornament.productImage,
  );
  const facePx = landmarks.faceWidth * previewSize.width;
  const longestSide = Math.max(imageWidth, imageHeight, 1);
  const target = ornament.category === 'earrings' ? facePx * 0.42 : facePx * 1.15;
  const fittedScale = (target / longestSide) * ornament.scale;
  const width = imageWidth * fittedScale;
  const height = imageHeight * fittedScale;

  if (ornament.category === 'earrings') {
    const placements: OverlayPlacement[] = [];
    const lobeDrop = facePx * 0.04;
    if (isVisibleEar(landmarks.leftEar)) {
      placements.push({
        x:
          toPixels(landmarks.leftEar.x, previewSize.width) -
          width / 2 +
          ornament.offset.x * fittedScale,
        y:
          toPixels(landmarks.leftEar.y, previewSize.height) +
          lobeDrop +
          ornament.offset.y * fittedScale,
        width,
        height,
        rotation: landmarks.roll,
      });
    }
    if (isVisibleEar(landmarks.rightEar)) {
      placements.push({
        x:
          toPixels(landmarks.rightEar.x, previewSize.width) -
          width / 2 -
          ornament.offset.x * fittedScale,
        y:
          toPixels(landmarks.rightEar.y, previewSize.height) +
          lobeDrop +
          ornament.offset.y * fittedScale,
        width,
        height,
        rotation: landmarks.roll,
        flip: true,
      });
    }
    return placements;
  }

  return [
    {
      x:
        toPixels(landmarks.neck.x, previewSize.width) -
        width / 2 +
        ornament.offset.x * fittedScale,
      y:
        toPixels(landmarks.neck.y, previewSize.height) +
        ornament.offset.y * fittedScale,
      width,
      height,
      rotation: landmarks.roll * 0.35,
    },
  ];
}
