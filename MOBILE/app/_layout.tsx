import '../global.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts, BeVietnamPro_400Regular, BeVietnamPro_500Medium, BeVietnamPro_600SemiBold, BeVietnamPro_700Bold } from '@expo-google-fonts/be-vietnam-pro';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { AssistantProvider } from '../context/AssistantContext';
import { Colors } from '../constants/theme';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AlertModal, AppLoadingScreen, NoFacilityScreen } from '../components';
import { AssistantBubble } from '../components/assistant';
import { ROUTES, canAccessRoute } from '../navigation/routes';
import { SWIPE_BACK_OPTIONS } from '../navigation/stackOptions';
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
  const { isLoading, isAuthenticated, facilities, user } = useAuth();

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
      {/* Vuốt từ trái sang phải ở bất kỳ đâu để quay lại trang trước (SWIPE_BACK_OPTIONS dùng chung cho mọi Stack, kể cả Stack lồng nhau) */}
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.bg.primary }, ...SWIPE_BACK_OPTIONS }}>
        <Stack.Protected guard={!isAuthenticated}>
          <Stack.Screen name="auth" />
        </Stack.Protected>
        <Stack.Protected guard={isAuthenticated}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="classes/[id]" />
          <Stack.Screen name="schedule/[scheduleId]" />
          <Stack.Screen name="chat" />
          <Stack.Screen name="notifications" />
          <Stack.Screen name="assistant" options={{ animation: 'slide_from_bottom' }} />
          {/* Mở từ menu Tài khoản. Phải nằm trong nhóm có bảo vệ: màn không thuộc nhóm nào là màn expo-router
              nhảy tới tạm thời khi đăng nhập/đăng xuất làm gỡ nhóm cũ → trang Hướng dẫn hiện chớp lên */}
          <Stack.Screen name="help" />
          <Stack.Screen name="policies" />
        </Stack.Protected>
        <Stack.Protected guard={isAuthenticated && user?.role === 'MEMBER'}>
          <Stack.Screen name="membership/plans" />
          <Stack.Screen name="payment/[paymentId]" />
          <Stack.Screen name="attendance/my" />
          <Stack.Screen name="member" />
          <Stack.Screen name="invoice/[id]" />
        </Stack.Protected>
        <Stack.Protected guard={isAuthenticated && user?.role === 'COACH'}>
          <Stack.Screen name="coach" />
        </Stack.Protected>
      </Stack>
      {/* Bong bóng trợ lý AI nổi trên mọi màn hình sau khi đăng nhập (kéo được, có dấu "x" tắt 10 giây) */}
      {isAuthenticated ? <AssistantBubble /> : null}
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
            <AssistantProvider>
              <StatusBar style="light" />
              <RootLayoutContent />
              <AlertModal />
            </AssistantProvider>
          </AuthProvider>
        </QueryClientProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
