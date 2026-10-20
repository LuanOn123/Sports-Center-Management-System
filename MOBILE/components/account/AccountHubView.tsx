// components/account/AccountHubView.tsx
// Tab "Tài khoản": thẻ người dùng + menu nhóm theo vai trò (navigation/accountMenuConfig.ts) + đăng xuất.
// Thay cho lưới "Truy cập nhanh" 12 ô trước đây — mỗi chức năng chỉ có một lối vào.

import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Avatar } from '../shared/Avatar';
import { ScreenHeader } from '../shared/ScreenHeader';
import { Card, ListGroup, ListRow, StatusBadge } from '../ui';
import { useAccountHub } from '../../hooks/shared/useAccountHub';
import { Colors, Spacing } from '../../constants/theme';
import { TIER_LABEL } from '../../constants/membership';
import { ROLE_LABEL } from '../../constants/profile';
import { ROUTES } from '../../navigation/routes';

export function AccountHubView() {
  const router = useRouter();
  const { user, tier, menu, confirmLogout } = useAccountHub();

  return (
    <View className="flex-1 bg-bg-primary">
      <ScreenHeader variant="tab" title="Tài khoản" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xxxl }}>
        <Card className="mb-xl" onPress={() => router.push(ROUTES.profile)} accessibilityLabel="Thông tin cá nhân">
          <View className="flex-row items-center gap-md">
            <Avatar uri={user?.avatarUrl} name={user?.fullName} size={56} />
            <View className="flex-1">
              <Text className="text-lg font-bevn-bold text-text-primary" numberOfLines={1}>{user?.fullName}</Text>
              <Text className="text-sm text-text-secondary font-bevn-regular mb-xs" numberOfLines={1}>{user?.email}</Text>
              <View className="flex-row gap-xs">
                <StatusBadge label={ROLE_LABEL[user?.role ?? 'MEMBER']} color={Colors.primary} />
                {tier && <StatusBadge label={`Hạng ${TIER_LABEL[tier]}`} color={Colors.tier[tier]} />}
              </View>
            </View>
          </View>
        </Card>

        {menu.map((group) => (
          <ListGroup key={group.title} title={group.title}>
            {group.items.map((item, index) => (
              <ListRow
                key={item.label}
                icon={item.icon}
                iconColor={item.color}
                title={item.label}
                subtitle={item.description}
                onPress={() => router.push(item.route)}
                last={index === group.items.length - 1}
              />
            ))}
          </ListGroup>
        ))}

        <ListGroup>
          <ListRow icon="logout" title="Đăng xuất" danger onPress={confirmLogout} last />
        </ListGroup>
      </ScrollView>
    </View>
  );
}
