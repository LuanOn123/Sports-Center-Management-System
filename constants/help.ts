// constants/help.ts
// Nội dung "Hướng dẫn sử dụng" (web: FE/src/shared/HelpPanel.tsx) cho Hội viên và Huấn luyện viên. Ba chủ đề đầu của Hội viên và hai chủ đề
// đầu của HLV theo web nhưng viết lại theo màn hình của mobile (tab, menu Tài khoản); thêm chủ đề "Điểm danh" cho mỗi vai trò vì
// quét mã và tạo mã QR chỉ làm được trên điện thoại.
// Mỗi bước phải khớp luồng thật của app (tên tab, nút, thời gian mở điểm danh) — đổi màn hình thì sửa chữ ở đây.

/** Màn mở bằng nút "Mở chức năng" của một chủ đề (đường dẫn ở navigation/helpConfig) */
export type HelpTarget = 'classes' | 'coachClasses' | 'membershipPlans' | 'profile' | 'myAttendance' | 'schedule' | 'coachAttendance';

export interface HelpGuide {
  id: string;
  title: string;
  /** Ba bước như web */
  steps: readonly string[];
  target: HelpTarget;
}

export const MEMBER_GUIDES: readonly HelpGuide[] = [
  {
    id: 'classes',
    title: 'Tìm và đăng ký lớp học',
    target: 'classes',
    steps: [
      'Mở tab Khám phá, tìm lớp theo bộ môn, hạng lớp, khu vực hoặc kỳ học.',
      'Mở chi tiết lớp, kiểm tra điều kiện gói và các buổi của khóa trước khi đăng ký.',
      'Theo dõi kết quả trong tab Lịch tập (Lịch tập và Lớp của tôi).',
    ],
  },
  {
    id: 'membership',
    title: 'Theo dõi gói tập và thanh toán',
    target: 'membershipPlans',
    steps: [
      'Vào Tài khoản → Gói thành viên để xem trạng thái, ngày hết hạn và quyền lợi gói.',
      'Khi thanh toán online, dùng đúng nội dung chuyển khoản hiển thị.',
      'Nếu trạng thái chưa cập nhật, kiểm tra đơn đang chờ trước khi tạo đơn khác.',
    ],
  },
  {
    id: 'profile',
    title: 'Cập nhật hồ sơ và mục tiêu tập luyện',
    target: 'profile',
    steps: [
      'Vào Tài khoản → Thông tin cá nhân & bảo mật, điền mục tiêu và trình độ tập luyện rồi lưu hồ sơ.',
      'Cập nhật sở thích tập luyện để huấn luyện viên hiểu nhu cầu của bạn.',
      'Xem các buổi đã đăng ký ở tab Lịch tập.',
    ],
  },
  {
    id: 'attendance',
    title: 'Điểm danh buổi học',
    target: 'myAttendance',
    steps: [
      'Từ 30 phút trước giờ học đến khi buổi kết thúc, huấn luyện viên hiện mã QR hoặc mã dự phòng 6 ký tự.',
      'Mở Điểm danh & chuyên cần, bấm Quét QR / Nhập mã điểm danh rồi quét mã hoặc nhập mã dự phòng.',
      'Gói tập phải còn hiệu lực lúc điểm danh. Tỉ lệ chuyên cần và lịch sử điểm danh xem ngay trong màn đó.',
    ],
  },
];

export const COACH_GUIDES: readonly HelpGuide[] = [
  {
    id: 'schedule',
    title: 'Xem lịch giảng dạy',
    target: 'schedule',
    steps: [
      'Mở tab Lịch dạy, xem theo tuần hoặc tháng và lọc theo lớp hoặc trạng thái.',
      'Bấm một buổi học để xem danh sách học viên và điểm danh.',
      'Kiểm tra trạng thái buổi học trước khi thực hiện điểm danh.',
    ],
  },
  {
    id: 'classes',
    title: 'Theo dõi lớp phụ trách',
    target: 'coachClasses',
    steps: [
      'Vào Tài khoản → Lớp phụ trách để xem các lớp được phân công.',
      'Bấm Chi tiết lớp để xem buổi dạy sắp tới, hoặc Xem lịch dạy để lọc lịch theo lớp đó.',
      'Trong danh sách điểm danh, mở hồ sơ học viên để xem mục tiêu và ghi nhận tiến độ bằng nút Đánh giá.',
    ],
  },
  {
    id: 'attendance',
    title: 'Điểm danh học viên',
    target: 'coachAttendance',
    steps: [
      'Mở tab Điểm danh và chọn buổi học. Điểm danh mở từ 30 phút trước giờ bắt đầu đến khi buổi kết thúc.',
      'Bấm Điểm danh ở từng học viên, chọn Có mặt, Đi muộn hoặc Vắng mặt; có thể thêm ghi chú.',
      'Bấm Tạo mã QR để học viên quét hoặc nhập mã dự phòng. Điểm danh đã lưu chỉ quản lý được sửa.',
    ],
  },
];

export const HELP_TEXT = {
  title: 'Hướng dẫn sử dụng',
  intro: 'Các bước thực hiện những công việc thường dùng trong không gian của bạn.',
  searchLabel: 'Tìm hướng dẫn',
  searchPlaceholder: 'Ví dụ: lịch, gói, thanh toán…',
  openFeature: 'Mở chức năng',
  noResult: 'Không tìm thấy hướng dẫn. Thử từ khóa khác hoặc xóa nội dung tìm kiếm.',
  policies: 'Xem chính sách sử dụng của trung tâm',
  /** Mục trong menu Tài khoản */
  menuDescription: 'Các bước cho việc thường dùng',
} as const;

/** Mục "Thao tác bàn phím và tin nhắn" của web, viết lại cho điện thoại */
export const HELP_TIPS = {
  title: 'Tin nhắn và tệp đính kèm',
  items: [
    'Muốn nhắn người mới: gõ tên vào ô tìm ở tab Tin nhắn.',
    'Gửi tin: bấm nút gửi (trên máy tính: Enter để gửi, Shift + Enter để xuống dòng).',
    'Chấm xanh trên ảnh đại diện là người đang trực tuyến; "đang nhập…" cho biết người kia đang soạn tin.',
    'Chạm vào ảnh đã gửi để xem lớn, có nút phóng to / thu nhỏ; bấm Tải để lưu hoặc chia sẻ tệp.',
    'Tệp đính kèm: JPEG, PNG, WebP, GIF hoặc PDF; tối đa 10 MB.',
  ],
} as const;
