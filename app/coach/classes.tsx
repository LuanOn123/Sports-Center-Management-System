// app/coach/classes.tsx — Lớp phụ trách của HLV (mở từ Trang chủ / menu Tài khoản); hội viên dùng tab Khám phá.
// Cùng View với tab Khám phá (components/classes/ClassesExploreView tự nhận vai trò) nhưng nằm trong khu vực coach để vuốt quay lại được.
import { ClassesExploreView } from '../../components/classes/ClassesExploreView';

export default function CoachClassesScreen() {
  return <ClassesExploreView />;
}
