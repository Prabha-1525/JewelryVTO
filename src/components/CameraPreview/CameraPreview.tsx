import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  Camera,
  useCameraDevice,
  type CameraFrameOutput,
  type CameraOutput,
  type CameraPhotoOutput,
  type TargetCameraPosition,
} from 'react-native-vision-camera';
import { colors } from '../../theme';

type CameraPreviewProps = {
  facing: TargetCameraPosition;
  isActive: boolean;
  photoOutput?: CameraPhotoOutput;
  frameOutput?: CameraFrameOutput;
  onReadyChange?: (ready: boolean) => void;
  onError?: (message: string) => void;
};

export function CameraPreview({
  facing,
  isActive,
  photoOutput,
  frameOutput,
  onReadyChange,
  onError,
}: CameraPreviewProps) {
  const device = useCameraDevice(facing);
  const outputs = useMemo(() => {
    const next: CameraOutput[] = [];
    if (photoOutput) {
      next.push(photoOutput);
    }
    if (frameOutput) {
      next.push(frameOutput);
    }
    return next;
  }, [frameOutput, photoOutput]);

  if (device == null) {
    return (
      <View style={styles.fallback}>
        <Text style={styles.fallbackTitle}>Camera unavailable</Text>
        <Text style={styles.fallbackCopy}>
          No {facing} camera was found on this device.
        </Text>
      </View>
    );
  }

  return (
    <Camera
      style={StyleSheet.absoluteFill}
      device={device}
      isActive={isActive}
      outputs={outputs}
      resizeMode="cover"
      onStarted={() => onReadyChange?.(true)}
      onStopped={() => onReadyChange?.(false)}
      onError={error =>
        onError?.(error.message.split('\n')[0] ?? error.message)
      }
    />
  );
}

const styles = StyleSheet.create({
  fallback: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.ink,
    padding: 24,
  },
  fallbackTitle: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  fallbackCopy: {
    color: colors.white,
    opacity: 0.75,
    textAlign: 'center',
  },
});
