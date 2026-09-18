import React from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useContacts } from '../../hooks/shared/useChat';
import type { ChatContact } from '../../lib/types';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../../constants/theme';

const ROLE_LABEL: Record<string, string> = {
  COACH: 'Huấn luyện viên',
  MEMBER: 'Hội viên',
  STAFF: 'Nhân viên',
  MANAGER: 'Quản lý',
};

const ROLE_COLOR: Record<string, string> = {
  COACH: Colors.accent,
  MEMBER: Colors.status.scheduled,
  STAFF: Colors.status.suspended,
  MANAGER: Colors.primary,
};

export default function ChatContactsScreen() {
  const router = useRouter();

  // ─── Hooks (logic) ──────────────────────────────────────────────────────────
  const { contacts, isLoading } = useContacts();

  const byRole = contacts.reduce<Record<string, ChatContact[]>>((acc, c) => {
    const role = c.role ?? 'OTHER';
    acc[role] = acc[role] ?? [];
    acc[role].push(c);
    return acc;
  }, {});

  const sections = Object.entries(byRole).map(([role, members]) => ({ role, members }));

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/chat');
    }
  };

  // ─── UI ─────────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
          <MaterialIcons name="arrow-back" size={22} color={Colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chọn người nhắn</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} size="large" />
      ) : (
        <FlatList
          data={sections}
          keyExtractor={s => s.role}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialIcons name="people-outline" size={48} color={Colors.text.muted} style={{ marginBottom: Spacing.md }} />
              <Text style={styles.emptyTitle}>Không có liên hệ</Text>
              <Text style={styles.emptyText}>Chưa có người dùng phù hợp để nhắn tin</Text>
            </View>
          }
          renderItem={({ item: section }) => (
            <View>
              <View style={[styles.roleHeader, { borderLeftColor: ROLE_COLOR[section.role] ?? Colors.border }]}>
                <Text style={[styles.roleLabel, { color: ROLE_COLOR[section.role] ?? Colors.text.muted }]}>
                  {ROLE_LABEL[section.role] ?? section.role}
                </Text>
              </View>
              {section.members.map(contact => (
                <TouchableOpacity
                  key={contact.id}
                  style={styles.contactCard}
                  onPress={() => router.push({ pathname: '/chat/[userId]', params: { userId: contact.id, name: contact.fullName } } as any)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.avatar, { borderColor: ROLE_COLOR[contact.role] ?? Colors.border }]}>
                    <Text style={styles.avatarText}>{contact.fullName[0]?.toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.contactName}>{contact.fullName}</Text>
                    <Text style={styles.contactEmail}>{contact.email}</Text>
                  </View>
                  <MaterialIcons name="chevron-right" size={20} color={Colors.text.muted} />
                </TouchableOpacity>
              ))}
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingHorizontal: Spacing.lg, paddingTop: Platform.OS === 'ios' ? 54 : Spacing.xl,
    paddingBottom: Spacing.md, backgroundColor: Colors.bg.surface,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.text.primary, fontFamily: 'BeVietnamPro_700Bold' },

  list: { paddingHorizontal: Spacing.xl, paddingBottom: 120, paddingTop: Spacing.lg },
  empty: { alignItems: 'center', marginTop: 60, paddingHorizontal: Spacing.xl },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.text.primary, fontFamily: 'BeVietnamPro_700Bold', marginBottom: Spacing.sm },
  emptyText: { fontSize: FontSize.sm, color: Colors.text.muted, fontFamily: 'BeVietnamPro_400Regular', textAlign: 'center' },

  roleHeader: { borderLeftWidth: 3, paddingLeft: Spacing.md, marginBottom: Spacing.sm, marginTop: Spacing.lg },
  roleLabel: { fontSize: FontSize.xs, fontFamily: 'BeVietnamPro_700Bold', textTransform: 'uppercase', letterSpacing: 1 },

  contactCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.bg.surface, borderRadius: Radius.lg, padding: Spacing.lg,
    borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.sm,
  },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.bg.elevated, justifyContent: 'center', alignItems: 'center', borderWidth: 2 },
  avatarText: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.text.primary, fontFamily: 'BeVietnamPro_700Bold' },
  contactName: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.text.primary, fontFamily: 'BeVietnamPro_700Bold' },
  contactEmail: { fontSize: FontSize.sm, color: Colors.text.muted, fontFamily: 'BeVietnamPro_400Regular' },
});
