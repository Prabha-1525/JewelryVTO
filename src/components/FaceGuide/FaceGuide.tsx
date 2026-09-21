import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme';

type TrackingStatusProps = {
  visible: boolean;
  message: string;
};

export function TrackingStatus({ visible, message }: TrackingStatusProps) {
  if (!visible) {
    return null;
  }

  return (
    <View pointerEvents="none" style={styles.wrap}>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 118,
    left: 24,
    right: 24,
    alignItems: 'center',
  },
  message: {
    color: colors.white,
    fontSize: 13,
    letterSpacing: 0.4,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
});
