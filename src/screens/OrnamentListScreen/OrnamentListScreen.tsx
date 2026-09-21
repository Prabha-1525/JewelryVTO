import { FlatList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OrnamentCard } from '../../components';
import { getOrnamentsByCategory } from '../../data';
import type { OrnamentListScreenProps } from '../../navigation';
import { colors, spacing } from '../../theme';
import type { Ornament } from '../../types';

export function OrnamentListScreen({
  navigation,
  route,
}: OrnamentListScreenProps) {
  const insets = useSafeAreaInsets();
  const ornaments = getOrnamentsByCategory(route.params.category);

  const openTryOn = (ornament: Ornament) => {
    navigation.navigate('TryOn', { ornamentId: ornament.id });
  };

  return (
    <FlatList
      data={ornaments}
      keyExtractor={item => item.id}
      numColumns={2}
      columnWrapperStyle={styles.row}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + spacing.lg },
      ]}
      renderItem={({ item }) => (
        <View style={styles.item}>
          <OrnamentCard ornament={item} onPress={openTryOn} />
        </View>
      )}
      style={styles.list}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
  },
  row: {
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  item: {
    flex: 1,
  },
});
