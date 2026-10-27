// Đường dẫn cũ "Xin nghỉ phép" — Coach giờ gửi yêu cầu đổi HLV theo buổi (giống web: /coach/leave → /coach/coach-changes)
import { Redirect } from 'expo-router';
import { ROUTES } from '../../navigation/routes';

export default function CoachLeaveRedirect() {
  return <Redirect href={ROUTES.coachChanges} />;
}
