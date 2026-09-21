import { Linking, Platform } from 'react-native';

export async function openAppSettings(): Promise<void> {
  if (Platform.OS === 'ios') {
    await Linking.openURL('app-settings:');
    return;
  }

  await Linking.openSettings();
}
