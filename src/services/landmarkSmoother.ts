import type { FaceLandmarks, Point2D } from '../types';

function lerp(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

function lerpPoint(from: Point2D, to: Point2D, amount: number): Point2D {
  return {
    x: lerp(from.x, to.x, amount),
    y: lerp(from.y, to.y, amount),
  };
}

function lerpAngle(from: number, to: number, amount: number): number {
  let diff = to - from;
  while (diff > Math.PI) {
    diff -= Math.PI * 2;
  }
  while (diff < -Math.PI) {
    diff += Math.PI * 2;
  }
  return from + diff * amount;
}

export class LandmarkSmoother {
  private current: FaceLandmarks | null = null;
  private lastDetectedAt = 0;

  reset(): void {
    this.current = null;
    this.lastDetectedAt = 0;
  }

  next(sample: FaceLandmarks | null, holdMs = 280): FaceLandmarks | null {
    const now = Date.now();
    if (sample == null) {
      if (this.current == null || now - this.lastDetectedAt > holdMs) {
        this.current = null;
      }
      return this.current;
    }

    this.lastDetectedAt = now;
    if (this.current == null) {
      this.current = sample;
      return sample;
    }

    const amount = 0.38;
    this.current = {
      leftEar: lerpPoint(this.current.leftEar, sample.leftEar, amount),
      rightEar: lerpPoint(this.current.rightEar, sample.rightEar, amount),
      chin: lerpPoint(this.current.chin, sample.chin, amount),
      nose: lerpPoint(this.current.nose, sample.nose, amount),
      forehead: lerpPoint(this.current.forehead, sample.forehead, amount),
      neck: lerpPoint(this.current.neck, sample.neck, amount),
      roll: lerpAngle(this.current.roll, sample.roll, amount),
      faceWidth: lerp(this.current.faceWidth, sample.faceWidth, amount),
    };
    return this.current;
  }
}
