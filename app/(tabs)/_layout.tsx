import { Tabs } from 'expo-router';
import { Platform, View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, FontSize } from '../../constants/theme';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';

type TabIconProps = { color: string | { toString(): string }; size: number };

function TabIcon({ name, ...props }: TabIconProps & { name: React.ComponentProps<typeof MaterialIcons>['name'] }) {
  return <MaterialIcons name={name} size={20} color={String(props.color)} />;
}

function ChatTabIcon({ color, size }: TabIconProps) {
  const { data } = useQuery({
    queryKey: ['chat-unread-count'],
    queryFn: () => api.get<number>('/chat/messages/unread-count'),
    refetchInterval: 30_000, // poll every 30s
  });

  const count = data?.data ?? 0;

  return (
    <View style={{ position: 'relative' }}>
      <MaterialIcons name="chat" size={20} color={String(color)} />
      {count > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count > 99 ? '99+' : String(count)}</Text>
        </View>
      )}
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.bg.surface,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 85 : 72,
          paddingBottom: Platform.OS === 'ios' ? 20 : 8,
          paddingTop: 2,
        },
        tabBarItemStyle: {
          paddingVertical: 4,
          justifyContent: 'center',
          alignItems: 'center',
        },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.text.muted,
        tabBarLabelStyle: {
          fontSize: 10.5,
          fontFamily: 'BeVietnamPro_500Medium',
          lineHeight: 14,
          padding: 0,
          margin: 0,
        },
        tabBarIconStyle: {
          marginBottom: 1,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Trang chủ',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="home" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="classes"
        options={{
          title: 'Lớp học',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="fitness-center" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: 'Lịch tập',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="event" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="training"
        options={{
          title: 'Tập luyện',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="trending-up" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Nhắn tin',
          tabBarIcon: ({ color, size }) => (
            <ChatTabIcon color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Thông báo',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="notifications" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: Colors.status.expired,
    borderRadius: 99,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: Colors.bg.surface,
  },
  badgeText: {
    fontSize: 9,
    fontFamily: 'BeVietnamPro_700Bold',
    color: '#fff',
    lineHeight: 13,
  },
});
