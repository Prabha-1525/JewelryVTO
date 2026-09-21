import { useMemo, useRef } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  NitroVtoView,
  type HybridRef,
  type NitroVtoViewMethods,
  type NitroVtoViewProps,
} from '@alaneu/react-native-nitro-vto';
import { callback } from 'react-native-nitro-modules';
import { colors, radii, spacing, typography } from '../../theme';
import type { Ornament } from '../../types';
import { openAppSettings } from '../../utils';
import { TrackingStatus } from '../FaceGuide';
import { OrnamentPreview } from './OrnamentPreview';

export type TryOnMode = 'ar' | 'preview';

type VtoRef = HybridRef<NitroVtoViewProps, NitroVtoViewMethods>;

type TryOnStageProps = {
  mode: TryOnMode;
  ornament: Ornament;
  isActive: boolean;
  hasPermission: boolean;
  canRequestPermission: boolean;
  trackingVisible: boolean;
  onModelLoaded: (url: string) => void;
  onFaceTracked: () => void;
  onOrnamentDisplayed: (url: string) => void;
  onArUnavailable: (reason: string) => void;
  onRequestPermission: () => void;
  vtoRef?: (ref: VtoRef | null) => void;
};

export function TryOnStage({
  mode,
  ornament,
  isActive,
  hasPermission,
  canRequestPermission,
  trackingVisible,
  onModelLoaded,
  onFaceTracked,
  onOrnamentDisplayed,
  onArUnavailable,
  onRequestPermission,
  vtoRef,
}: TryOnStageProps) {
  const lastModelUrl = useRef('');
  const modelUrl = useMemo(() => {
    const asset =
      mode === 'preview' && ornament.previewGlbAsset != null
        ? ornament.previewGlbAsset
        : ornament.glbAsset;
    return Image.resolveAssetSource(asset)?.uri ?? '';
  }, [mode, ornament.glbAsset, ornament.previewGlbAsset]);
  if (modelUrl) {
    lastModelUrl.current = modelUrl;
  }
  const resolvedModelUrl = modelUrl || lastModelUrl.current;
  const handleModelLoaded = useMemo(
    () => callback(onModelLoaded),
    [onModelLoaded],
  );
  const handleFaceTracked = useMemo(
    () => callback(onFaceTracked),
    [onFaceTracked],
  );
  const handleOrnamentDisplayed = useMemo(
    () => callback(onOrnamentDisplayed),
    [onOrnamentDisplayed],
  );
  const handleArUnavailable = useMemo(
    () => callback(onArUnavailable),
    [onArUnavailable],
  );
  const handleHybridRef = useMemo(
    () =>
      callback((ref: VtoRef) => {
        vtoRef?.(ref);
      }),
    [vtoRef],
  );

  if (mode === 'ar' && !hasPermission) {
    return (
      <View style={styles.permissionPane}>
        <Text style={styles.permissionTitle}>Camera access needed</Text>
        <Text style={styles.permissionCopy}>
          Allow camera access to preview how this{' '}
          {ornament.category.slice(0, -1)} fits in real time.
        </Text>
        <Pressable
          onPress={() => {
            if (canRequestPermission) {
              onRequestPermission();
              return;
            }
            openAppSettings();
          }}
          style={styles.primaryButton}
        >
          <Text style={styles.primaryButtonLabel}>
            {canRequestPermission ? 'Allow camera' : 'Open settings'}
          </Text>
        </Pressable>
      </View>
    );
  }

  if (!resolvedModelUrl) {
    return <OrnamentPreview ornament={ornament} />;
  }

  return (
    <View style={StyleSheet.absoluteFill}>
      <NitroVtoView
        style={StyleSheet.absoluteFill}
        modelUrl={resolvedModelUrl}
        isActive={isActive}
        isClipOn={false}
        mode={mode}
        previewBackgroundColor={colors.preview}
        forwardOffset={ornament.forwardOffset}
        debug={false}
        showNativeFPS={false}
        onModelLoaded={handleModelLoaded}
        onFaceTracked={handleFaceTracked}
        onGlassesDisplayed={handleOrnamentDisplayed}
        onArUnavailable={handleArUnavailable}
        hybridRef={handleHybridRef}
      />
      <TrackingStatus
        visible={trackingVisible}
        message="Look at the camera so your ears can be tracked"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  permissionPane: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.ink,
  },
  permissionTitle: {
    ...typography.title,
    color: colors.white,
    textAlign: 'center',
  },
  permissionCopy: {
    ...typography.body,
    color: 'rgba(255,255,255,0.72)',
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  primaryButton: {
    backgroundColor: colors.gold,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  primaryButtonLabel: {
    color: colors.ink,
    fontWeight: '700',
  },
});
