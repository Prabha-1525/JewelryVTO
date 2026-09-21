import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OrnamentCard } from '../../components';
import { APP_NAME, CATEGORIES } from '../../constants';
import { ornaments } from '../../data';
import type { HomeScreenProps } from '../../navigation';
import { colors, radii, spacing, typography } from '../../theme';
import type { Ornament, OrnamentCategory } from '../../types';

export function HomeScreen({ navigation }: HomeScreenProps) {
  const insets = useSafeAreaInsets();
  const featured = ornaments.slice(0, 4);

  const openCategory = (category: OrnamentCategory) => {
    navigation.navigate('OrnamentList', { category });
  };

  const openTryOn = (ornament: Ornament) => {
    navigation.navigate('TryOn', { ornamentId: ornament.id });
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + spacing.lg,
          paddingBottom: insets.bottom + spacing.xl,
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.kicker}>VIRTUAL TRY-ON</Text>
      <Text style={styles.title}>{APP_NAME}</Text>
      <Text style={styles.lede}>
        Preview earrings and necklaces on your face, ears, and neck using the
        front camera.
      </Text>

      <Text style={styles.sectionTitle}>Categories</Text>
      <View style={styles.categoryList}>
        {CATEGORIES.map(category => (
          <Pressable
            key={category.id}
            onPress={() => openCategory(category.id)}
            style={({ pressed }) => [
              styles.categoryCard,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.categoryTitle}>{category.title}</Text>
            <Text style={styles.categorySubtitle}>{category.subtitle}</Text>
            <Text style={styles.categoryAction}>Browse collection</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Featured ornaments</Text>
      <View style={styles.featuredGrid}>
        {featured.map(item => (
          <View key={item.id} style={styles.featuredItem}>
            <OrnamentCard ornament={item} onPress={openTryOn} />
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.lg,
  },
  kicker: {
    ...typography.caption,
    color: colors.goldDark,
    marginBottom: spacing.xs,
  },
  title: {
    ...typography.display,
    color: colors.ink,
  },
  lede: {
    ...typography.body,
    color: colors.muted,
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
    lineHeight: 22,
  },
  sectionTitle: {
    ...typography.title,
    color: colors.ink,
    marginBottom: spacing.md,
  },
  categoryList: {
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  categoryCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.line,
  },
  categoryTitle: {
    ...typography.title,
    color: colors.ink,
  },
  categorySubtitle: {
    ...typography.body,
    color: colors.muted,
    marginTop: 4,
  },
  categoryAction: {
    ...typography.caption,
    color: colors.burgundy,
    marginTop: spacing.md,
  },
  featuredGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  featuredItem: {
    width: '47.5%',
    flexGrow: 1,
  },
  pressed: {
    opacity: 0.88,
  },
});
