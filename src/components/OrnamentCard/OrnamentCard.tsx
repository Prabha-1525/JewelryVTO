import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, typography } from '../../theme';
import type { Ornament } from '../../types';
import { formatPrice } from '../../utils';

type OrnamentCardProps = {
  ornament: Ornament;
  onPress: (ornament: Ornament) => void;
  compact?: boolean;
  selected?: boolean;
  dark?: boolean;
};

export function OrnamentCard({
  ornament,
  onPress,
  compact = false,
  selected = false,
  dark = false,
}: OrnamentCardProps) {
  return (
    <Pressable
      onPress={() => onPress(ornament)}
      style={({ pressed }) => [
        styles.card,
        compact && styles.compactCard,
        dark && styles.darkCard,
        selected && styles.selected,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.imageWrap, compact && styles.compactImageWrap]}>
        <Image
          source={ornament.productImage}
          style={styles.image}
          resizeMode="contain"
        />
      </View>
      <View style={styles.meta}>
        <Text
          style={[styles.category, dark && styles.darkCategory]}
          numberOfLines={1}
        >
          {ornament.category.toUpperCase()}
        </Text>
        <Text
          style={[styles.name, dark && styles.darkName]}
          numberOfLines={compact ? 1 : 2}
        >
          {ornament.name}
        </Text>
        <Text style={[styles.price, dark && styles.darkPrice]}>
          {formatPrice(ornament.price)}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.line,
  },
  compactCard: {
    width: 132,
  },
  darkCard: {
    backgroundColor: 'rgba(255,251,245,0.96)',
  },
  selected: {
    borderColor: colors.gold,
    borderWidth: 2,
  },
  pressed: {
    opacity: 0.86,
  },
  imageWrap: {
    height: 168,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
  },
  compactImageWrap: {
    height: 108,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  meta: {
    padding: spacing.md,
    gap: 4,
  },
  category: {
    ...typography.caption,
    color: colors.goldDark,
  },
  name: {
    ...typography.subtitle,
    color: colors.ink,
  },
  price: {
    ...typography.body,
    color: colors.burgundy,
    fontWeight: '700',
  },
  darkCategory: {
    color: colors.goldDark,
  },
  darkName: {
    color: colors.ink,
  },
  darkPrice: {
    color: colors.goldDark,
  },
});
