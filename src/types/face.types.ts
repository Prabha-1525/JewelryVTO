export type Point2D = {
  x: number;
  y: number;
};

export type Size2D = {
  width: number;
  height: number;
};

export type FaceLandmarks = {
  leftEar: Point2D;
  rightEar: Point2D;
  forehead: Point2D;
  chin: Point2D;
  nose: Point2D;
  neck: Point2D;
  roll: number;
  faceWidth: number;
};

export type OverlayPlacement = {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  flip?: boolean;
};
