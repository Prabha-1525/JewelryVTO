import { Image, StyleSheet, View } from 'react-native';
import { colors } from '../../theme';
import type { Ornament } from '../../types';

type OrnamentPreviewProps = {
  ornament: Ornament;
};

export function OrnamentPreview({ ornament }: OrnamentPreviewProps) {
  return (
    <View style={styles.stage}>
      <Image
        source={ornament.productImage}
        style={styles.model}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.preview,
  },
  model: {
    width: '72%',
    height: '58%',
  },
});
