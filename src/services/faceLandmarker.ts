import { NativeModules } from 'react-native';
import type { FaceLandmarks, Point2D } from '../types';

type NativePoint = {
  x: number;
  y: number;
};

export type NativeLandmarkResult = {
  detected: boolean;
  skipped?: boolean;
  leftEar: NativePoint;
  rightEar: NativePoint;
  chin: NativePoint;
  nose: NativePoint;
  forehead: NativePoint;
  neck: NativePoint;
  roll: number;
  faceWidth: number;
};

type FaceLandmarkerNative = {
  initialize(): Promise<boolean>;
  detect(
    width: number,
    height: number,
    rotationDegrees: number,
    mirrored: boolean,
    pixelsBase64: string,
  ): Promise<NativeLandmarkResult>;
  dispose(): Promise<boolean>;
};

const native = NativeModules.FaceLandmarker as FaceLandmarkerNative | undefined;

function toLandmarks(result: NativeLandmarkResult): FaceLandmarks {
  return {
    leftEar: result.leftEar,
    rightEar: result.rightEar,
    chin: result.chin,
    nose: result.nose,
    forehead: result.forehead,
    neck: result.neck,
    roll: result.roll,
    faceWidth: result.faceWidth,
  };
}

/**
 * MediaPipe Face Landmarker service.
 * Native code runs Google's Face Landmarker task; this wrapper is the
 * only UI-facing API so the detector can be replaced without screen changes.
 */
class FaceLandmarkerService {
  private ready = false;
  private inflight = false;

  isAvailable(): boolean {
    return native != null;
  }

  async initialize(): Promise<void> {
    if (native == null) {
      this.ready = false;
      return;
    }
    await native.initialize();
    this.ready = true;
  }

  isReady(): boolean {
    return this.ready;
  }

  async detectFrame(input: {
    width: number;
    height: number;
    rotationDegrees: number;
    mirrored: boolean;
    pixelsBase64: string;
  }): Promise<FaceLandmarks | null | undefined> {
    if (native == null || !this.ready || this.inflight) {
      return undefined;
    }

    this.inflight = true;
    try {
      const result = await native.detect(
        input.width,
        input.height,
        input.rotationDegrees,
        input.mirrored,
        input.pixelsBase64,
      );
      if (result?.skipped) {
        return undefined;
      }
      if (!result?.detected) {
        return null;
      }
      return toLandmarks(result);
    } finally {
      this.inflight = false;
    }
  }

  detect(_frame?: unknown): FaceLandmarks | null {
    return null;
  }

  async dispose(): Promise<void> {
    this.ready = false;
    if (native != null) {
      await native.dispose();
    }
  }
}

export const faceLandmarker = new FaceLandmarkerService();

export function isVisibleEar(point: Point2D): boolean {
  return point.x > 0.02 && point.x < 0.98 && point.y > 0.02 && point.y < 0.98;
}
