import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { CATEGORIES } from '../constants';
import { HomeScreen, OrnamentListScreen, TryOnScreen } from '../screens';
import { colors } from '../theme';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Home"
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.ink,
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '600' },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="OrnamentList"
        component={OrnamentListScreen}
        options={({ route }) => ({
          title:
            CATEGORIES.find(category => category.id === route.params.category)
              ?.title ?? 'Ornaments',
        })}
      />
      <Stack.Screen
        name="TryOn"
        component={TryOnScreen}
        options={{
          headerShown: false,
          animation: 'fade',
          contentStyle: { backgroundColor: colors.ink },
        }}
      />
    </Stack.Navigator>
  );
}
