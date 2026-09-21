import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCameraPermission } from 'react-native-vision-camera';
import { ProductSheet, TryOnStage, type TryOnMode } from '../../components';
import {
  getNextOrnament,
  getOrnamentById,
  getOrnamentsByCategory,
  getPreviousOrnament,
} from '../../data';
import type { TryOnScreenProps } from '../../navigation';
import { colors, radii, spacing, typography } from '../../theme';
import type { Ornament } from '../../types';

export function TryOnScreen({ navigation, route }: TryOnScreenProps) {
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const { hasPermission, requestPermission, canRequestPermission } =
    useCameraPermission();

  const [ornamentId, setOrnamentId] = useState(route.params.ornamentId);
  const [mode, setMode] = useState<TryOnMode>('ar');
  const [isAppActive, setIsAppActive] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [sheetExpanded, setSheetExpanded] = useState(true);
  const [sheetHeight, setSheetHeight] = useState(268);
  const [faceTracked, setFaceTracked] = useState(false);
  const [arUnavailable, setArUnavailable] = useState<string | null>(null);
  const loadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const ornament =
    getOrnamentById(ornamentId) ?? getOrnamentById(route.params.ornamentId);
  const relatedOrnaments = useMemo(
    () => (ornament ? getOrnamentsByCategory(ornament.category) : []),
    [ornament],
  );

  const isAr = mode === 'ar';
  const isActive = isFocused && isAppActive && (isAr ? hasPermission : true);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      setIsAppActive(state === 'active');
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!hasPermission && canRequestPermission && isAr) {
      requestPermission();
    }
  }, [canRequestPermission, hasPermission, isAr, requestPermission]);

  useEffect(() => {
    setFaceTracked(false);
    setIsLoading(true);
    if (loadTimer.current) {
      clearTimeout(loadTimer.current);
    }
    return () => {
      if (loadTimer.current) {
        clearTimeout(loadTimer.current);
      }
    };
  }, [ornamentId]);

  const handleModelLoaded = useCallback((_url: string) => {
    if (loadTimer.current) {
      clearTimeout(loadTimer.current);
    }
    loadTimer.current = setTimeout(() => {
      setIsLoading(false);
    }, 300);
  }, []);

  const handleFaceTracked = useCallback(() => {
    setFaceTracked(true);
  }, []);

  const handleOrnamentDisplayed = useCallback((_url: string) => {
    setIsLoading(false);
  }, []);

  const handleArUnavailable = useCallback((reason: string) => {
    setArUnavailable(reason);
    setMode('preview');
    setIsLoading(false);
  }, []);

  const selectOrnament = (next: Ornament) => {
    setOrnamentId(next.id);
  };

  if (ornament == null) {
    return (
      <View style={styles.centered}>
        <Text style={styles.permissionTitle}>Ornament not found</Text>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.primaryButton}
        >
          <Text style={styles.primaryButtonLabel}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.preview}>
        <TryOnStage
          mode={mode}
          ornament={ornament}
          isActive={isActive}
          hasPermission={hasPermission}
          canRequestPermission={canRequestPermission}
          trackingVisible={isAr && hasPermission && !faceTracked}
          onModelLoaded={handleModelLoaded}
          onFaceTracked={handleFaceTracked}
          onOrnamentDisplayed={handleOrnamentDisplayed}
          onArUnavailable={handleArUnavailable}
          onRequestPermission={requestPermission}
        />

        {isLoading ? (
          <View style={styles.loadingOverlay}>
            <Text style={styles.loadingText}>Loading ornament...</Text>
          </View>
        ) : null}

        {arUnavailable && isAr ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>
              Live AR is unavailable ({arUnavailable}). Showing preview.
            </Text>
          </View>
        ) : null}
      </View>

      <View
        pointerEvents="box-none"
        style={[styles.overlayChrome, { paddingTop: insets.top + spacing.sm }]}
      >
        <View style={styles.topBar}>
          <RoundButton label="Back" onPress={() => navigation.goBack()} />
          <View style={styles.topSpacer} />
        </View>

        <View style={styles.modelLabel}>
          <Text style={styles.modelLabelCode}>
            {ornament.category.toUpperCase()}
          </Text>
          <Text style={styles.modelLabelName}>{ornament.name}</Text>
        </View>
      </View>

      <View
        pointerEvents="box-none"
        style={[
          styles.captureWrap,
          { bottom: Math.max(sheetHeight, 96) + spacing.sm },
        ]}
      >
        <RoundButton
          label="Prev"
          onPress={() => selectOrnament(getPreviousOrnament(ornament.id))}
        />
        <View style={styles.shutterSpacer} />
        <RoundButton
          label="Next"
          onPress={() => selectOrnament(getNextOrnament(ornament.id))}
        />
      </View>

      <View
        pointerEvents="box-none"
        style={[
          styles.modeWrap,
          { bottom: Math.max(sheetHeight, 96) + 92 },
        ]}
      >
        <Pressable
          onPress={() =>
            setMode(current => (current === 'ar' ? 'preview' : 'ar'))
          }
          style={({ pressed }) => [styles.modeButton, pressed && styles.pressed]}
        >
          <Text style={styles.modeLabel}>
            {mode === 'ar' ? 'Mode: Live AR' : 'Mode: Preview'}
          </Text>
        </Pressable>
      </View>

      <ProductSheet
        ornament={ornament}
        relatedOrnaments={relatedOrnaments}
        expanded={sheetExpanded}
        bottomInset={insets.bottom}
        onToggle={() => setSheetExpanded(current => !current)}
        onExpandedChange={setSheetExpanded}
        onHeightChange={setSheetHeight}
        onSelectOrnament={selectOrnament}
      />
    </View>
  );
}

function RoundButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.roundButton, pressed && styles.pressed]}
    >
      <Text style={styles.roundLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  preview: {
    ...StyleSheet.absoluteFill,
  },
  overlayChrome: {
    ...StyleSheet.absoluteFill,
  },
  topBar: {
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  topSpacer: {
    minWidth: 78,
  },
  modelLabel: {
    marginTop: spacing.md,
    alignItems: 'center',
  },
  modelLabelCode: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textShadowColor: 'rgba(0, 0, 0, 0.55)',
    textShadowRadius: 4,
  },
  modelLabelName: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
    textShadowColor: 'rgba(0, 0, 0, 0.55)',
    textShadowRadius: 4,
  },
  captureWrap: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  shutterSpacer: {
    width: 72,
    height: 72,
  },
  modeWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  modeButton: {
    backgroundColor: 'rgba(16, 10, 8, 0.55)',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: 'rgba(196, 161, 90, 0.35)',
  },
  modeLabel: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 13,
  },
  roundButton: {
    backgroundColor: 'rgba(16, 10, 8, 0.55)',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minWidth: 78,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(196, 161, 90, 0.35)',
  },
  roundLabel: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 13,
  },
  permissionTitle: {
    ...typography.title,
    color: colors.white,
    textAlign: 'center',
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
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.ink,
    gap: spacing.md,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  errorBanner: {
    position: 'absolute',
    top: 88,
    left: spacing.md,
    right: spacing.md,
    backgroundColor: colors.danger,
    borderRadius: radii.sm,
    padding: spacing.sm,
  },
  errorText: {
    color: colors.white,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.82,
  },
});
