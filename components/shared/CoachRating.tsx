// components/shared/CoachRating.tsx
// Đánh giá HLV — hiển thị điểm trung bình, danh sách đánh giá và form gửi/sửa của Member

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { Icon as MaterialIcons } from './Icon';
import { useAuth } from '../../context/AuthContext';
import {
  useCoachFeedbacks, useMyFeedbacks, useSubmitFeedback, useDeleteFeedback,
} from '../../hooks/shared/useFeedback';
import { showAlert, showConfirm } from '../../lib/alert';
import { ApiError } from '../../lib/api';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../../constants/theme';

function Stars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <MaterialIcons key={i} name={i <= value ? 'star' : 'star-border'} size={size} color={Colors.tier.PREMIUM} />
      ))}
    </View>
  );
}

function StarInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <TouchableOpacity key={i} onPress={() => onChange(i)} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
          <MaterialIcons name={i <= value ? 'star' : 'star-border'} size={28} color={Colors.tier.PREMIUM} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days < 1) return 'Hôm nay';
  if (days < 30) return `${days} ngày trước`;
  return new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

interface CoachRatingProps {
  coachId: string;
  coachName?: string;
  classId?: string;
}

export function CoachRating({ coachId, coachName, classId }: CoachRatingProps) {
  const { user } = useAuth();
  const isMember = user?.role === 'MEMBER';

  const { feedbacks, summary, isLoading } = useCoachFeedbacks(coachId, classId);
  const { feedbacks: myFeedbacks } = useMyFeedbacks();
  const submitMutation = useSubmitFeedback();
  const deleteMutation = useDeleteFeedback();

  const myExisting = useMemo(
    () => myFeedbacks.find((f) => f.coachId === coachId && (f.classId ?? undefined) === (classId ?? undefined)),
    [myFeedbacks, coachId, classId]
  );

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [editing, setEditing] = useState(false);

  const startEdit = () => {
    setRating(myExisting?.rating ?? 0);
    setComment(myExisting?.comment ?? '');
    setIsAnonymous(myExisting?.isAnonymous ?? false);
    setEditing(true);
  };

  const handleSubmit = () => {
    if (rating < 1) {
      showAlert('Thiếu thông tin', 'Vui lòng chọn số sao đánh giá.');
      return;
    }
    submitMutation.mutate(
      { coachId, classId, rating, comment: comment.trim() || undefined, isAnonymous },
      {
        onSuccess: () => {
          setEditing(false);
          showAlert('Đã gửi', 'Cảm ơn bạn đã gửi đánh giá!');
        },
        onError: (e) => {
          const msg = e instanceof ApiError ? e.message : 'Gửi đánh giá thất bại. Vui lòng thử lại.';
          showAlert('Lỗi', msg);
        },
      }
    );
  };

  const handleDelete = () => {
    if (!myExisting) return;
    showConfirm(
      'Xóa đánh giá',
      'Bạn có chắc muốn xóa đánh giá của mình?',
      () => {
        deleteMutation.mutate(myExisting.id, {
          onError: (e) => {
            const msg = e instanceof ApiError ? e.message : 'Xóa thất bại. Vui lòng thử lại.';
            showAlert('Lỗi', msg);
          },
        });
      },
      undefined,
      'Xóa',
      true
    );
  };

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>Đánh Giá {coachName ? `· ${coachName}` : 'Huấn Luyện Viên'}</Text>
        {summary.totalFeedbacks > 0 && (
          <View style={styles.summaryRow}>
            <Stars value={Math.round(summary.averageRating ?? 0)} />
            <Text style={styles.summaryText}>
              {summary.averageRating?.toFixed(1)} ({summary.totalFeedbacks})
            </Text>
          </View>
        )}
      </View>

      {isMember && (
        <View style={styles.myBox}>
          {editing ? (
            <View style={{ gap: Spacing.sm }}>
              <StarInput value={rating} onChange={setRating} />
              <TextInput
                style={styles.input}
                value={comment}
                onChangeText={setComment}
                placeholder="Nhận xét (không bắt buộc)"
                placeholderTextColor={Colors.text.muted}
                multiline
                maxLength={1000}
              />
              <TouchableOpacity style={styles.anonRow} onPress={() => setIsAnonymous((v) => !v)}>
                <MaterialIcons
                  name={isAnonymous ? 'check-box' : 'check-box-outline-blank'}
                  size={20}
                  color={Colors.primary}
                />
                <Text style={styles.anonText}>Ẩn danh</Text>
              </TouchableOpacity>
              <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
                <TouchableOpacity
                  style={[styles.submitBtn, { flex: 1 }]}
                  onPress={handleSubmit}
                  disabled={submitMutation.isPending}
                >
                  {submitMutation.isPending ? (
                    <ActivityIndicator color={Colors.text.inverse} size="small" />
                  ) : (
                    <Text style={styles.submitBtnText}>{myExisting ? 'Cập nhật' : 'Gửi đánh giá'}</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelEditBtn} onPress={() => setEditing(false)}>
                  <Text style={styles.cancelEditText}>Hủy</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : myExisting ? (
            <View>
              <View style={styles.headerRow}>
                <Text style={styles.myLabel}>Đánh giá của bạn</Text>
                <Stars value={myExisting.rating} />
              </View>
              {Boolean(myExisting.comment) && <Text style={styles.myComment}>{myExisting.comment}</Text>}
              <View style={{ flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.sm }}>
                <TouchableOpacity onPress={startEdit}><Text style={styles.linkText}>Sửa</Text></TouchableOpacity>
                <TouchableOpacity onPress={handleDelete}><Text style={[styles.linkText, { color: Colors.status.expired }]}>Xóa</Text></TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity style={styles.rateBtn} onPress={startEdit}>
              <MaterialIcons name="star-border" size={18} color={Colors.primary} />
              <Text style={styles.rateBtnText}>Đánh giá HLV này</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {isLoading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: Spacing.md }} />
      ) : feedbacks.length === 0 ? (
        <Text style={styles.emptyText}>Chưa có đánh giá nào.</Text>
      ) : (
        feedbacks.map((f) => (
          <View key={f.id} style={styles.reviewCard}>
            <View style={styles.headerRow}>
              <Text style={styles.reviewerName}>{f.isAnonymous ? 'Ẩn danh' : f.member?.user?.fullName ?? 'Hội viên'}</Text>
              <Stars value={f.rating} size={13} />
            </View>
            {Boolean(f.comment) && <Text style={styles.reviewComment}>{f.comment}</Text>}
            <Text style={styles.reviewTime}>{timeAgo(f.createdAt)}</Text>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: Spacing.xl },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.text.primary, fontFamily: 'BeVietnamPro_700Bold', marginBottom: Spacing.md },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  summaryText: { fontSize: FontSize.sm, color: Colors.text.secondary, fontFamily: 'BeVietnamPro_600SemiBold' },

  myBox: { backgroundColor: Colors.bg.elevated, borderRadius: Radius.lg, padding: Spacing.lg, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  myLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.text.primary, fontFamily: 'BeVietnamPro_600SemiBold' },
  myComment: { fontSize: FontSize.sm, color: Colors.text.secondary, marginTop: 4, fontFamily: 'BeVietnamPro_400Regular' },
  linkText: { fontSize: FontSize.sm, color: Colors.primary, fontFamily: 'BeVietnamPro_600SemiBold' },

  rateBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: Spacing.sm },
  rateBtnText: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: FontWeight.semibold, fontFamily: 'BeVietnamPro_600SemiBold' },

  input: {
    backgroundColor: Colors.bg.surface, borderRadius: Radius.md, padding: Spacing.md,
    color: Colors.text.primary, fontFamily: 'BeVietnamPro_400Regular', fontSize: FontSize.sm,
    minHeight: 60, borderWidth: 1, borderColor: Colors.border,
  },
  anonRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  anonText: { fontSize: FontSize.sm, color: Colors.text.secondary, fontFamily: 'BeVietnamPro_400Regular' },
  submitBtn: { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: Spacing.sm, alignItems: 'center' },
  submitBtnText: { color: Colors.text.inverse, fontWeight: FontWeight.bold, fontSize: FontSize.sm, fontFamily: 'BeVietnamPro_700Bold' },
  cancelEditBtn: { paddingHorizontal: Spacing.lg, justifyContent: 'center', alignItems: 'center', borderRadius: Radius.md, backgroundColor: Colors.bg.surface, borderWidth: 1, borderColor: Colors.border },
  cancelEditText: { color: Colors.text.muted, fontSize: FontSize.sm, fontFamily: 'BeVietnamPro_500Medium' },

  emptyText: { fontSize: FontSize.sm, color: Colors.text.muted, fontFamily: 'BeVietnamPro_400Regular', fontStyle: 'italic' },
  reviewCard: { backgroundColor: Colors.bg.surface, borderRadius: Radius.lg, padding: Spacing.md, marginTop: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  reviewerName: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.text.primary, fontFamily: 'BeVietnamPro_600SemiBold' },
  reviewComment: { fontSize: FontSize.sm, color: Colors.text.secondary, marginTop: 4, fontFamily: 'BeVietnamPro_400Regular' },
  reviewTime: { fontSize: FontSize.xs, color: Colors.text.muted, marginTop: 4, fontFamily: 'BeVietnamPro_400Regular' },
});
