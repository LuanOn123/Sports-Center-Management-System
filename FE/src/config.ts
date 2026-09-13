export const labels: Record<string, string> = {
  fullName: "Họ và tên",
  email: "Email",
  password: "Mật khẩu",
  role: "Vai trò",
  phone: "Số điện thoại",
  gender: "Giới tính",
  name: "Tên",
  description: "Mô tả",
  capacity: "Sức chứa",
  location: "Vị trí",
  price: "Giá gói (VNĐ)",
  durationDays: "Thời hạn (ngày)",
  tier: "Hạng thành viên",
  isActive: "Đang hoạt động",
  fitnessGoal: "Mục tiêu tập luyện",
  trainingLevel: "Trình độ",
  trainingPreference: "Thời gian yêu thích",
  specialization: "Chuyên môn",
  experienceYears: "Số năm kinh nghiệm",
  bio: "Giới thiệu",
  sportId: "Bộ môn",
  classId: "Lớp học",
  roomId: "Phòng tập",
  coachId: "Huấn luyện viên",
  classType: "Loại lớp",
  startTime: "Bắt đầu",
  endTime: "Kết thúc",
  status: "Trạng thái",
  isPrimary: "Huấn luyện viên chính",
  search: "Tìm kiếm",
  date: "Ngày",
  startDate: "Từ ngày",
  endDate: "Đến ngày",
  startAfter: "Bắt đầu sau",
  startBefore: "Bắt đầu trước",
  currentPassword: "Mật khẩu hiện tại",
  newPassword: "Mật khẩu mới",
  MEMBER: "Hội viên",
  COACH: "Huấn luyện viên",
  STAFF: "Lễ tân",
  MANAGER: "Quản lý",
  MEMBERSHIP: "Tiêu chuẩn",
  PREMIUM: "Cao cấp",
  FREE: "Miễn phí",
  REGULAR: "Tiêu chuẩn",
  BEGINNER: "Cơ bản",
  INTERMEDIATE: "Trung cấp",
  ADVANCED: "Nâng cao",
  SCHEDULED: "Đã lên lịch",
  CANCELLED: "Đã hủy",
  COMPLETED: "Hoàn thành",
  ACTIVE: "Hiệu lực",
  EXPIRED: "Hết hạn",
  SUSPENDED: "Tạm dừng",
  SUCCESS: "Thành công",
  PENDING: "Chờ xử lý",
  FAILED: "Thất bại",
  REFUNDED: "Hoàn tiền",
  CASH: "Tiền mặt",
  BANK_TRANSFER: "Chuyển khoản",
  MALE: "Nam",
  FEMALE: "Nữ",
  OTHER: "Khác",
  true: "Hoạt động",
  false: "Ngừng hoạt động",
  totalRevenue: "Tổng doanh thu",
  totalPayments: "Tổng thanh toán",
  successPayments: "Thành công",
  failedPayments: "Thất bại",
  pendingPayments: "Chờ xử lý",
  refundedPayments: "Hoàn tiền",
  totalMembers: "Tổng hội viên",
  newMembers: "Hội viên mới",
  activeMembers: "Còn hiệu lực",
  expiredMembers: "Hết hạn",
  totalEnrollments: "Lượt đăng ký",
  cancelledEnrollments: "Lượt hủy",
  totalSubscriptions: "Tổng gói đăng ký",
  newSubscriptions: "Đăng ký mới",
  activeSubscriptions: "Đang hiệu lực",
  expiredSubscriptions: "Đã hết hạn",
  cancelledSubscriptions: "Đã hủy",
  suspendedSubscriptions: "Tạm dừng",
  amount: "Số tiền",
  method: "Phương thức",
  invoiceNumber: "Mã hóa đơn",
  createdAt: "Ngày tạo",
  dateOfBirth: "Ngày sinh",
  effectiveTier: "Hạng hiện tại",
  daysRemaining: "Số ngày còn lại",
  endDateLabel: "Ngày hết hạn",
  bookedAt: "Ngày đăng ký",
  paidAt: "Ngày thanh toán",
  id: "Mã định danh",
  user: "Thông tin tài khoản",
  coachProfile: "Hồ sơ huấn luyện viên",
  memberProfile: "Hồ sơ hội viên",
  managerProfile: "Hồ sơ quản lý",
  subscriptions: "Gói đã đăng ký",
  plan: "Gói tập",
  sport: "Bộ môn",
  room: "Phòng tập",
  class: "Lớp học",
  coaches: "Huấn luyện viên",
  schedules: "Lịch học",
  _count: "Thống kê",
  enrollments: "Lượt đăng ký",
  classes: "Lớp học",
  activeSubscription: "Gói đang hiệu lực",
  updatedAt: "Cập nhật lần cuối",
};
export const label = (s: string) => labels[s] || s;
export const money = (v: unknown) =>
  v == null || v === "" || !Number.isFinite(Number(v))
    ? "—"
    : new Intl.NumberFormat("vi-VN", {
        style: "currency",
        currency: "VND",
      }).format(Number(v));
export function at(row: unknown, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (v, k) =>
        v && typeof v === "object"
          ? (v as Record<string, unknown>)[k]
          : undefined,
      row,
    );
}
export function display(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "boolean") return v ? "Hoạt động" : "Ngừng hoạt động";
  if (typeof v === "object")
    return Array.isArray(v)
      ? `${v.length} mục`
      : String(at(v, "name") || at(v, "fullName") || "—");
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v))
    return new Date(v).toLocaleString("vi-VN", {
      dateStyle: "short",
      timeStyle: "short",
    });
  return label(String(v));
}
export interface Resource {
  slug: string;
  title: string;
  subtitle: string;
  path: string;
  create?: string;
  role?: string;
  columns: [string, string][];
}
export const resources: Resource[] = [
  {
    slug: "users",
    title: "Người dùng",
    subtitle: "Kết nối con người. Xây dựng cộng đồng.",
    path: "/users",
    columns: [
      ["fullName", "Họ và tên"],
      ["email", "Email"],
      ["role", "Vai trò"],
      ["isActive", "Trạng thái"],
    ],
  },
  {
    slug: "members",
    title: "Hội viên",
    subtitle: "Đồng hành trên từng hành trình tập luyện.",
    path: "/members",
    create: "/users",
    role: "MEMBER",
    columns: [
      ["user.fullName", "Hội viên"],
      ["user.email", "Email"],
      ["trainingLevel", "Trình độ"],
      ["fitnessGoal", "Mục tiêu"],
    ],
  },
  {
    slug: "coaches",
    title: "Huấn luyện viên",
    subtitle: "Đội ngũ truyền cảm hứng mỗi ngày.",
    path: "/coaches",
    create: "/users",
    role: "COACH",
    columns: [
      ["fullName", "Huấn luyện viên"],
      ["email", "Email"],
      ["coachProfile.specialization", "Chuyên môn"],
      ["coachProfile.experienceYears", "Kinh nghiệm"],
    ],
  },
  {
    slug: "staff",
    title: "Đội ngũ lễ tân",
    subtitle: "Chăm sóc từng trải nghiệm tại trung tâm.",
    path: "/users",
    role: "STAFF",
    columns: [
      ["fullName", "Họ và tên"],
      ["email", "Email"],
      ["phone", "Điện thoại"],
      ["isActive", "Trạng thái"],
    ],
  },
  {
    slug: "membership-plans",
    title: "Gói thành viên",
    subtitle: "Lựa chọn linh hoạt. Giá trị bền vững.",
    path: "/membership-plans",
    columns: [
      ["name", "Tên gói"],
      ["tier", "Hạng"],
      ["price", "Giá gói"],
      ["durationDays", "Số ngày"],
      ["isActive", "Trạng thái"],
    ],
  },
  {
    slug: "sports",
    title: "Bộ môn",
    subtitle: "Mở rộng đam mê, nâng tầm chuyển động.",
    path: "/sports",
    columns: [
      ["name", "Bộ môn"],
      ["description", "Mô tả"],
      ["_count.classes", "Số lớp"],
      ["isActive", "Trạng thái"],
    ],
  },
  {
    slug: "rooms",
    title: "Phòng tập",
    subtitle: "Không gian sẵn sàng cho mọi mục tiêu.",
    path: "/rooms",
    columns: [
      ["name", "Phòng tập"],
      ["location", "Vị trí"],
      ["capacity", "Sức chứa"],
      ["isActive", "Trạng thái"],
    ],
  },
  {
    slug: "classes",
    title: "Lớp học",
    subtitle: "Mỗi lớp học là một khởi đầu mới.",
    path: "/classes",
    columns: [
      ["name", "Lớp học"],
      ["sport.name", "Bộ môn"],
      ["classType", "Loại lớp"],
      ["capacity", "Sức chứa"],
      ["isActive", "Trạng thái"],
    ],
  },
  {
    slug: "schedules",
    title: "Lịch hoạt động",
    subtitle: "Một nhịp vận hành, mọi thứ trong tầm tay.",
    path: "/class-schedules",
    columns: [
      ["class.name", "Lớp học"],
      ["room.name", "Phòng tập"],
      ["startTime", "Bắt đầu"],
      ["endTime", "Kết thúc"],
      ["status", "Trạng thái"],
    ],
  },
];
