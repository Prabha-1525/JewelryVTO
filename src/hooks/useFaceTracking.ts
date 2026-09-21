import { useCallback, useEffect, useRef, useState } from 'react';
import { runOnJS } from 'react-native-worklets';
import { useFrameOutput } from 'react-native-vision-camera';
import type { CameraFrameOutput, Frame } from 'react-native-vision-camera';
import { faceLandmarker, LandmarkSmoother } from '../services';
import type { FaceLandmarks } from '../types';

type FramePayload = {
  width: number;
  height: number;
  rotationDegrees: number;
  mirrored: boolean;
  pixelsBase64: string;
};

const FRAME_TARGET = { width: 256, height: 256 };
const FRAME_MAX_SIDE = 192;
const BASE64_TABLE =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function orientationToDegrees(orientation: string): number {
  'worklet';
  if (orientation === 'right') {
    return 90;
  }
  if (orientation === 'down') {
    return 180;
  }
  if (orientation === 'left') {
    return 270;
  }
  return 0;
}

function downsampleRgba(
  source: Uint8Array,
  srcWidth: number,
  srcHeight: number,
  bytesPerRow: number,
  maxSide: number,
): { bytes: Uint8Array; width: number; height: number } {
  'worklet';
  const stride = bytesPerRow > 0 ? bytesPerRow : srcWidth * 4;
  const scale = maxSide / Math.max(srcWidth, srcHeight);
  const width = Math.max(1, Math.round(srcWidth * scale));
  const height = Math.max(1, Math.round(srcHeight * scale));

  const bytes = new Uint8Array(width * height * 4);
  const xRatio = srcWidth / width;
  const yRatio = srcHeight / height;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const sx = Math.min(srcWidth - 1, Math.floor(x * xRatio));
      const sy = Math.min(srcHeight - 1, Math.floor(y * yRatio));
      const srcIndex = sy * stride + sx * 4;
      const dstIndex = (y * width + x) * 4;
      bytes[dstIndex] = source[srcIndex] ?? 0;
      bytes[dstIndex + 1] = source[srcIndex + 1] ?? 0;
      bytes[dstIndex + 2] = source[srcIndex + 2] ?? 0;
      bytes[dstIndex + 3] = source[srcIndex + 3] ?? 255;
    }
  }
  return { bytes, width, height };
}

function uint8ToBase64(bytes: Uint8Array): string {
  'worklet';
  let output = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const b0 = bytes[index] ?? 0;
    const b1 = index + 1 < bytes.length ? bytes[index + 1] ?? 0 : 0;
    const b2 = index + 2 < bytes.length ? bytes[index + 2] ?? 0 : 0;
    const triplet = (b0 << 16) | (b1 << 8) | b2;
    output += BASE64_TABLE[(triplet >> 18) & 63];
    output += BASE64_TABLE[(triplet >> 12) & 63];
    output +=
      index + 1 < bytes.length ? BASE64_TABLE[(triplet >> 6) & 63] : '=';
    output += index + 2 < bytes.length ? BASE64_TABLE[triplet & 63] : '=';
  }
  return output;
}

export function useFaceTracking(
  enabled: boolean,
  resetKey?: string,
): {
  landmarks: FaceLandmarks | null;
  frameOutput: CameraFrameOutput;
  isReady: boolean;
} {
  const [landmarks, setLandmarks] = useState<FaceLandmarks | null>(null);
  const [isReady, setIsReady] = useState(false);
  const smootherRef = useRef(new LandmarkSmoother());
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  useEffect(() => {
    let cancelled = false;
    const smoother = smootherRef.current;
    faceLandmarker
      .initialize()
      .then(() => {
        if (!cancelled) {
          setIsReady(faceLandmarker.isReady());
        }
      })
      .catch(() => {
        if (!cancelled) {
          setIsReady(false);
        }
      });
    return () => {
      cancelled = true;
      smoother.reset();
      faceLandmarker.dispose();
    };
  }, []);

  useEffect(() => {
    smootherRef.current.reset();
    setLandmarks(null);
  }, [enabled, resetKey]);

  const onFramePixels = useCallback((payload: FramePayload) => {
    if (!enabledRef.current) {
      return;
    }
    faceLandmarker
      .detectFrame(payload)
      .then(result => {
        if (result === undefined) {
          return;
        }
        const smoothed = smootherRef.current.next(result);
        setLandmarks(smoothed);
      })
      .catch(() => {
        // Keep the last smoothed face if a frame fails.
      });
  }, []);

  const onFrame = useCallback(
    (frame: Frame) => {
      'worklet';
      try {
        if (!frame.hasPixelBuffer) {
          return;
        }
        const buffer = frame.getPixelBuffer();
        const source = new Uint8Array(buffer);
        const downsampled = downsampleRgba(
          source,
          frame.width,
          frame.height,
          frame.bytesPerRow,
          FRAME_MAX_SIDE,
        );
        runOnJS(onFramePixels)({
          width: downsampled.width,
          height: downsampled.height,
          rotationDegrees: orientationToDegrees(frame.orientation),
          mirrored: frame.isMirrored,
          pixelsBase64: uint8ToBase64(downsampled.bytes),
        });
      } catch {
        // A bad frame should not stall or crash the camera preview.
      } finally {
        frame.dispose();
      }
    },
    [onFramePixels],
  );

  const frameOutput = useFrameOutput({
    pixelFormat: 'rgb',
    enablePreviewSizedOutputBuffers: true,
    targetResolution: FRAME_TARGET,
    dropFramesWhileBusy: true,
    onFrame,
  });

  return { landmarks, frameOutput, isReady };
}
