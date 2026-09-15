import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, FontSize } from '../../constants/theme';

type TabIconProps = { color: string | { toString(): string }; size: number };

function TabIcon({ name, ...props }: TabIconProps & { name: React.ComponentProps<typeof MaterialIcons>['name'] }) {
  return <MaterialIcons name={name} size={22} color={String(props.color)} />;
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
          height: Platform.OS === 'ios' ? 88 : 68,
          paddingBottom: Platform.OS === 'ios' ? 28 : 10,
          paddingTop: 8,
        },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.text.muted,
        tabBarLabelStyle: {
          fontSize: 11,
          fontFamily: 'BeVietnamPro_500Medium',
          marginTop: 2,
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
          title: 'Hồ sơ',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="person" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}

