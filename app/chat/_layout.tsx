import { Stack } from 'expo-router';
import { SWIPE_BACK_OPTIONS } from '../../navigation/stackOptions';

export default function ChatLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, ...SWIPE_BACK_OPTIONS }} />
  );
}
