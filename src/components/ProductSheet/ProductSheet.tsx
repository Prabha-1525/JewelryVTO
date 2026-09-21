import { useMemo, useRef } from 'react';
import {
  Animated,
  Image,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors, radii, spacing, typography } from '../../theme';
import type { Ornament } from '../../types';
import { formatPrice } from '../../utils';

type ProductSheetProps = {
  ornament: Ornament;
  relatedOrnaments: Ornament[];
  expanded: boolean;
  bottomInset: number;
  onToggle: () => void;
  onExpandedChange: (expanded: boolean) => void;
  onSelectOrnament: (ornament: Ornament) => void;
  onHeightChange?: (height: number) => void;
};

export function ProductSheet({
  ornament,
  relatedOrnaments,
  expanded,
  bottomInset,
  onToggle,
  onExpandedChange,
  onSelectOrnament,
  onHeightChange,
}: ProductSheetProps) {
  const expandedRef = useRef(expanded);
  expandedRef.current = expanded;
  const drag = useRef(new Animated.Value(0)).current;

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dy) > 8 &&
          Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderMove: (_, gesture) => {
          drag.setValue(gesture.dy);
        },
        onPanResponderRelease: (_, gesture) => {
          drag.setValue(0);
          if (gesture.dy > 42 && expandedRef.current) {
            onExpandedChange(false);
            return;
          }
          if (gesture.dy < -42 && !expandedRef.current) {
            onExpandedChange(true);
          }
        },
      }),
    [drag, onExpandedChange],
  );

  return (
    <Animated.View
      style={[
        styles.sheet,
        !expanded && styles.collapsedSheet,
        {
          paddingBottom: Math.max(bottomInset, spacing.md),
          transform: [
            {
              translateY: drag.interpolate({
                inputRange: expanded ? [0, 180] : [-180, 0],
                outputRange: expanded ? [0, 28] : [-28, 0],
                extrapolate: 'clamp',
              }),
            },
          ],
        },
      ]}
      onLayout={event => onHeightChange?.(event.nativeEvent.layout.height)}
      {...panResponder.panHandlers}
    >
      <Pressable onPress={onToggle} style={styles.handleHit}>
        <View style={styles.handle} />
        <Text style={styles.handleLabel}>
          {expanded ? 'Hide details' : 'Show details'}
        </Text>
      </Pressable>

      {expanded ? (
        <>
          <View style={styles.productInfo}>
            <Text style={styles.productCategory}>
              {ornament.category.toUpperCase()}
            </Text>
            <Text style={styles.productName}>{ornament.name}</Text>
            <Text style={styles.productPrice}>
              {formatPrice(ornament.price)}
            </Text>
            <Text style={styles.productDescription} numberOfLines={2}>
              {ornament.description}
            </Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.photoStrip}
          >
            {relatedOrnaments.map(item => (
              <Pressable
                key={item.id}
                onPress={() => onSelectOrnament(item)}
                style={[
                  styles.photoCard,
                  item.id === ornament.id && styles.photoCardSelected,
                ]}
              >
                <Image
                  source={item.productImage}
                  style={styles.photo}
                  resizeMode="contain"
                />
              </Pressable>
            ))}
          </ScrollView>
        </>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(16, 10, 8, 0.82)',
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderTopWidth: 1,
    borderColor: 'rgba(196, 161, 90, 0.45)',
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  collapsedSheet: {
    minHeight: 88,
  },
  handleHit: {
    alignItems: 'center',
    paddingVertical: 4,
    gap: 6,
  },
  handle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.gold,
  },
  handleLabel: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.72)',
  },
  productInfo: {
    gap: 4,
  },
  productCategory: {
    ...typography.caption,
    color: colors.gold,
  },
  productName: {
    ...typography.title,
    color: colors.white,
  },
  productPrice: {
    ...typography.price,
    color: colors.gold,
  },
  productDescription: {
    ...typography.body,
    color: 'rgba(255,255,255,0.78)',
    lineHeight: 20,
  },
  photoStrip: {
    gap: spacing.sm,
    paddingBottom: spacing.xs,
  },
  photoCard: {
    width: 118,
    height: 118,
    borderRadius: radii.md,
    backgroundColor: colors.preview,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(196, 161, 90, 0.28)',
  },
  photoCardSelected: {
    borderColor: colors.gold,
    borderWidth: 2,
  },
  photo: {
    width: '86%',
    height: '86%',
  },
});
