import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../../constants/theme';

export default function NotificationsScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Thông Báo</Text>
        <Text style={styles.headerSub}>Cập nhật từ trung tâm</Text>
      </View>

      {/* Coming Soon Placeholder */}
      <View style={styles.placeholder}>
        <Text style={styles.icon}>🔔</Text>
        <Text style={styles.title}>Thông báo đang được phát triển</Text>
        <Text style={styles.desc}>
          Tính năng thông báo push sẽ được kích hoạt ở phiên bản tiếp theo.
          Bạn sẽ nhận được nhắc nhở về lịch học, gia hạn gói và cập nhật từ trung tâm.
        </Text>

        {/* Upcoming notification types */}
        {[
          { icon: '📅', label: 'Nhắc nhở lịch học', desc: 'Thông báo trước 30 phút khi lớp sắp bắt đầu' },
          { icon: '⏰', label: 'Hết hạn gói tập', desc: 'Cảnh báo khi gói thành viên sắp hết hạn' },
          { icon: '🏋️', label: 'Lớp học mới', desc: 'Thông báo khi có lớp học mới phù hợp với bạn' },
          { icon: '✅', label: 'Xác nhận đặt lịch', desc: 'Xác nhận ngay khi đặt lớp thành công' },
        ].map((item) => (
          <View key={item.label} style={styles.notifItem}>
            <View style={styles.notifIcon}>
              <Text style={styles.notifEmoji}>{item.icon}</Text>
            </View>
            <View style={styles.notifContent}>
              <Text style={styles.notifLabel}>{item.label}</Text>
              <Text style={styles.notifDesc}>{item.desc}</Text>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary },
  content: { padding: Spacing.xl, paddingBottom: Spacing.xxxl },
  header: { marginBottom: Spacing.xl },
  headerTitle: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.text.primary, fontFamily: 'BeVietnamPro_700Bold' },
  headerSub: { fontSize: FontSize.sm, color: Colors.text.secondary, marginTop: 2, fontFamily: 'BeVietnamPro_400Regular' },
  placeholder: {
    backgroundColor: Colors.bg.surface, borderRadius: Radius.xl,
    padding: Spacing.xl, alignItems: 'center', borderWidth: 1, borderColor: Colors.border,
  },
  icon: { fontSize: 56, marginBottom: Spacing.xl },
  title: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.text.primary, fontFamily: 'BeVietnamPro_700Bold', textAlign: 'center', marginBottom: Spacing.md },
  desc: { fontSize: FontSize.sm, color: Colors.text.secondary, fontFamily: 'BeVietnamPro_400Regular', textAlign: 'center', lineHeight: 22, marginBottom: Spacing.xl },
  notifItem: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, width: '100%', marginBottom: Spacing.md },
  notifIcon: {
    width: 44, height: 44, borderRadius: Radius.lg,
    backgroundColor: Colors.bg.elevated, justifyContent: 'center', alignItems: 'center',
  },
  notifEmoji: { fontSize: 20 },
  notifContent: { flex: 1 },
  notifLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.text.primary, fontFamily: 'BeVietnamPro_600SemiBold', marginBottom: 2 },
  notifDesc: { fontSize: FontSize.xs, color: Colors.text.muted, fontFamily: 'BeVietnamPro_400Regular' },
});
