// components/shared/CoachRating.tsx
// Đánh giá HLV — hiển thị điểm trung bình, danh sách đánh giá và form gửi/sửa của Member

import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { Icon } from './Icon';
import { useAuth } from '../../context/AuthContext';
import {
  useCoachFeedbacks, useMyFeedbacks, useSubmitFeedback, useDeleteFeedback,
} from '../../hooks/shared/useFeedback';
import { showAlert, showConfirm } from '../../lib/alert';
import { ApiError } from '../../lib/api';
import { Colors } from '../../constants/theme';

function Stars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <View className="flex-row gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Icon key={i} name={i <= value ? 'star' : 'star-border'} size={size} color={Colors.tier.PREMIUM} />
      ))}
    </View>
  );
}

function StarInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <View className="flex-row gap-1.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <TouchableOpacity key={i} onPress={() => onChange(i)} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
          <Icon name={i <= value ? 'star' : 'star-border'} size={28} color={Colors.tier.PREMIUM} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

// toLocaleDateString('vi-VN', ...) không đáng tin trên RN/Hermes — ICU của máy
// có thể trả dấu "-" thay vì "/" giữa ngày/tháng. Tự ghép chuỗi cho chắc.
function pad2(n: number) {
  return String(n).padStart(2, '0');
}
function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days < 1) return 'Hôm nay';
  if (days < 30) return `${days} ngày trước`;
  const d = new Date(iso);
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
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
    <View className="mb-xl">
      <View className="flex-row justify-between items-center">
        <Text className="text-lg font-bold font-bevn-bold text-text-primary mb-md">Đánh Giá {coachName ? `· ${coachName}` : 'Huấn Luyện Viên'}</Text>
        {summary.totalFeedbacks > 0 && (
          <View className="flex-row items-center gap-1.5">
            <Stars value={Math.round(summary.averageRating ?? 0)} />
            <Text className="text-sm font-bevn-semibold text-text-secondary">
              {summary.averageRating?.toFixed(1)} ({summary.totalFeedbacks})
            </Text>
          </View>
        )}
      </View>

      {isMember && (
        <View className="bg-bg-elevated rounded-lg p-lg mb-md border border-border">
          {editing ? (
            <View className="gap-sm">
              <StarInput value={rating} onChange={setRating} />
              <TextInput
                className="bg-bg-surface rounded-md p-md text-text-primary font-bevn-regular text-sm min-h-[60px] border border-border"
                value={comment}
                onChangeText={setComment}
                placeholder="Nhận xét (không bắt buộc)"
                placeholderTextColor={Colors.text.muted}
                multiline
                maxLength={1000}
              />
              <TouchableOpacity className="flex-row items-center gap-1.5" onPress={() => setIsAnonymous((v) => !v)}>
                <Icon
                  name={isAnonymous ? 'check-box' : 'check-box-outline-blank'}
                  size={20}
                  color={Colors.primary}
                />
                <Text className="text-sm font-bevn-regular text-text-secondary">Ẩn danh</Text>
              </TouchableOpacity>
              <View className="flex-row gap-sm">
                <TouchableOpacity
                  className="flex-1 bg-primary rounded-md py-sm items-center"
                  onPress={handleSubmit}
                  disabled={submitMutation.isPending}
                >
                  {submitMutation.isPending ? (
                    <ActivityIndicator color={Colors.text.inverse} size="small" />
                  ) : (
                    <Text className="text-text-inverse font-bold font-bevn-bold text-sm">{myExisting ? 'Cập nhật' : 'Gửi đánh giá'}</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  className="px-lg justify-center items-center rounded-md bg-bg-surface border border-border"
                  onPress={() => setEditing(false)}
                >
                  <Text className="text-text-muted text-sm font-bevn-medium">Hủy</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : myExisting ? (
            <View>
              <View className="flex-row justify-between items-center">
                <Text className="text-sm font-semibold font-bevn-semibold text-text-primary">Đánh giá của bạn</Text>
                <Stars value={myExisting.rating} />
              </View>
              {Boolean(myExisting.comment) && <Text className="text-sm text-text-secondary mt-1 font-bevn-regular">{myExisting.comment}</Text>}
              <View className="flex-row gap-md mt-sm">
                <TouchableOpacity onPress={startEdit}><Text className="text-sm text-primary font-bevn-semibold">Sửa</Text></TouchableOpacity>
                <TouchableOpacity onPress={handleDelete}><Text className="text-sm font-bevn-semibold text-status-expired">Xóa</Text></TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity className="flex-row items-center justify-center gap-1.5 py-sm" onPress={startEdit}>
              <Icon name="star-border" size={18} color={Colors.primary} />
              <Text className="text-primary text-sm font-semibold font-bevn-semibold">Đánh giá HLV này</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {isLoading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 12 }} />
      ) : feedbacks.length === 0 ? (
        <Text className="text-sm text-text-muted font-bevn-regular italic">Chưa có đánh giá nào.</Text>
      ) : (
        feedbacks.map((f) => (
          <View key={f.id} className="bg-bg-surface rounded-lg p-md mt-sm border border-border">
            <View className="flex-row justify-between items-center">
              <Text className="text-sm font-semibold font-bevn-semibold text-text-primary">{f.isAnonymous ? 'Ẩn danh' : f.member?.user?.fullName ?? 'Hội viên'}</Text>
              <Stars value={f.rating} size={13} />
            </View>
            {Boolean(f.comment) && <Text className="text-sm text-text-secondary mt-1 font-bevn-regular">{f.comment}</Text>}
            <Text className="text-xs text-text-muted mt-1 font-bevn-regular">{timeAgo(f.createdAt)}</Text>
          </View>
        ))
      )}
    </View>
  );
}
