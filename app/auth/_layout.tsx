import { Stack } from 'expo-router';
import { Colors } from '../../constants/theme';
import { SWIPE_BACK_OPTIONS } from '../../navigation/stackOptions';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.bg.primary },
        ...SWIPE_BACK_OPTIONS,
      }}
    />
  );
}
