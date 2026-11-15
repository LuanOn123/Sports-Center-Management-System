// components/member/TermBanner.tsx
// Banner kỳ học hiện tại cho hội viên (web: MemberTermBanner ở Dashboard và Khám phá lớp học): tên kỳ, giai đoạn đăng ký
// và "còn N ngày". Khi kỳ đang mở đăng ký, `withAction` thêm nút dẫn tới Khám phá. Chưa có kỳ học thì không hiện gì.

import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { TermNoticeCard } from '../classes/TermNoticeCard';
import { Button } from '../ui';
import { useCurrentTerm } from '../../hooks/shared/useTerms';
import { TERM_BANNER_TEXT } from '../../constants/terms';
import { termNotice } from '../../lib/termRegistration';
import { ROUTES } from '../../navigation/routes';

export function TermBanner({ withAction = false }: { withAction?: boolean }) {
  const router = useRouter();
  const { data: term } = useCurrentTerm();
  if (!term?.id) return null;

  const notice = termNotice(term);
  return (
    <View className="mb-lg">
      <TermNoticeCard
        termName={term.name}
        notice={notice}
        action={withAction && notice.phase === 'open'
          ? <Button title={TERM_BANNER_TEXT.explore} icon="explore" size="sm" block={false} onPress={() => router.push(ROUTES.classes)} />
          : undefined}
      />
    </View>
  );
}
