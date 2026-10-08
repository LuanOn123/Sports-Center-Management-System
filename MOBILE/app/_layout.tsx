import '../global.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts, BeVietnamPro_400Regular, BeVietnamPro_500Medium, BeVietnamPro_600SemiBold, BeVietnamPro_700Bold } from '@expo-google-fonts/be-vietnam-pro';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { Colors } from '../constants/theme';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AlertModal, AppLoadingScreen, NoFacilityScreen } from '../components';
import { ROUTES, canAccessRoute } from '../navigation/routes';
import { useAppStateFocus } from '../hooks/shared/useAppStateFocus';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

// Chặn route theo trạng thái đăng nhập VÀ vai trò (bảng quyền ở navigation/routes.ts)
function AuthGuard() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    const inAuth = segments[0] === 'auth';
    if (!isAuthenticated && !inAuth) {
      router.replace(ROUTES.login);
    } else if (isAuthenticated && inAuth) {
      router.replace(ROUTES.home);
    } else if (isAuthenticated && !canAccessRoute(user?.role, segments)) {
      router.replace(ROUTES.home);
    }
  }, [isAuthenticated, isLoading, user?.role, segments]);

  return null;
}

function RootLayoutContent() {
  const { isLoading, isAuthenticated, facilities } = useAuth();

  if (isLoading) {
    return <AppLoadingScreen message="Đang kiểm tra phiên đăng nhập..." />;
  }

  // Không có cơ sở thì BE từ chối gần như mọi API nghiệp vụ — báo rõ thay vì để màn hình toàn lỗi.
  if (isAuthenticated && facilities.length === 0) {
    return <NoFacilityScreen />;
  }

  return (
    <>
      <AuthGuard />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.bg.primary } }}>
        <Stack.Screen name="auth" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="classes/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="schedule/[scheduleId]" options={{ headerShown: false }} />
        <Stack.Screen name="membership/plans" options={{ headerShown: false }} />
        <Stack.Screen name="payment/[paymentId]" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}

import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    BeVietnamPro_400Regular,
    BeVietnamPro_500Medium,
    BeVietnamPro_600SemiBold,
    BeVietnamPro_700Bold,
  });
  // App quay lại foreground → React Query tải lại các màn đang mở (vd. trạng thái thanh toán)
  useAppStateFocus();

  if (!fontsLoaded) {
    return <AppLoadingScreen message="Đang tải giao diện..." />;
  }

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <StatusBar style="light" />
            <RootLayoutContent />
            <AlertModal />
          </AuthProvider>
        </QueryClientProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
