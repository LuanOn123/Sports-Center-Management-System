import { useState } from "react";
import { CircleHelp, ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Modal } from "./ui";

type Guide = { title: string; path: string; steps: string[] };
const guides: Record<string, Guide[]> = {
  MEMBER: [
    {
      title: "Tìm và đăng ký lớp học",
      path: "classes",
      steps: [
        "Tìm lớp phù hợp với bộ môn và lịch của bạn.",
        "Mở chi tiết, kiểm tra điều kiện gói và ca học trước khi xác nhận.",
        "Theo dõi kết quả trong Lớp của tôi và Lịch tập.",
      ],
    },
    {
      title: "Theo dõi gói tập và thanh toán",
      path: "membership",
      steps: [
        "Kiểm tra trạng thái, ngày hết hạn và quyền lợi gói.",
        "Khi thanh toán online, dùng đúng nội dung chuyển khoản hiển thị.",
        "Nếu trạng thái chưa cập nhật, kiểm tra đơn đang chờ trước khi tạo đơn khác.",
      ],
    },
    {
      title: "Cập nhật hồ sơ và mục tiêu tập luyện",
      path: "profile",
      steps: [
        "Điền mục tiêu và trình độ tập luyện rồi lưu hồ sơ.",
        "Cập nhật sở thích tập luyện để huấn luyện viên hiểu nhu cầu của bạn.",
        "Xem các buổi đã đăng ký tại Lịch tập.",
      ],
    },
  ],
  STAFF: [
    {
      title: "Tìm đúng hội viên",
      path: "members",
      steps: [
        "Tìm theo thông tin hội viên.",
        "Đối chiếu tên và thông tin liên hệ trước khi thao tác.",
        "Mở chi tiết để kiểm tra hồ sơ và quyền lợi hiện tại.",
      ],
    },
    {
      title: "Đăng ký gói tại quầy",
      path: "membership",
      steps: [
        "Chọn hội viên và kiểm tra gói đang sử dụng.",
        "Chọn đăng ký hoặc gia hạn phù hợp, đối chiếu số tiền.",
        "Chỉ xác nhận thanh toán tại quầy sau khi đã nhận đủ tiền.",
      ],
    },
    {
      title: "Tra cứu thanh toán",
      path: "payments",
      steps: [
        "Chọn hội viên để xem giao dịch.",
        "Mở chi tiết giao dịch và hóa đơn để đối chiếu.",
        "Giao dịch online được cập nhật qua hệ thống đối soát.",
      ],
    },
  ],
  MANAGER: [
    {
      title: "Quản lý lịch hoạt động",
      path: "schedules",
      steps: [
        "Chọn tuần hoặc tháng cần xem.",
        "Mở buổi học để kiểm tra phòng, huấn luyện viên và học viên.",
        "Dùng thao tác hoàn tất hoặc hủy riêng biệt theo trạng thái buổi học.",
      ],
    },
    {
      title: "Chuyển lịch phòng tập",
      path: "rooms",
      steps: [
        "Chọn phòng đang hoạt động và mở thao tác chuyển lịch.",
        "Chọn phòng đích, khoảng thời gian rồi xem trước.",
        "Kiểm tra xung đột trước khi xác nhận chuyển.",
      ],
    },
    {
      title: "Đọc báo cáo thu chi",
      path: "reports",
      steps: [
        "Chọn khoảng ngày cần xem.",
        "Phân biệt tổng thu, tiền hoàn và số thực nhận.",
        "Đối chiếu báo cáo với giao dịch chi tiết khi cần.",
      ],
    },
  ],
  COACH: [
    {
      title: "Xem lịch giảng dạy",
      path: "schedule",
      steps: [
        "Chọn khoảng thời gian và lớp được phân công.",
        "Mở buổi học để xem thông tin và học viên.",
        "Kiểm tra trạng thái buổi học trước khi thực hiện điểm danh.",
      ],
    },
    {
      title: "Theo dõi lớp phụ trách",
      path: "classes",
      steps: [
        "Mở lớp được phân công.",
        "Xem hồ sơ và mục tiêu học viên trong phạm vi lớp.",
        "Ghi nhận kết quả tập luyện theo quyền được cấp.",
      ],
    },
  ],
};

export function HelpPanel({ role, base }: { role: string; base: string }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const rows = (guides[role === "RECEPTIONIST" ? "STAFF" : role] || []).filter((guide) =>
    `${guide.title} ${guide.steps.join(" ")}`
      .toLocaleLowerCase("vi")
      .includes(search.trim().toLocaleLowerCase("vi")),
  );
  return (
    <>
      <button
        type="button"
        className="icon-button"
        aria-label="Hướng dẫn sử dụng"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <CircleHelp size={20} />
      </button>
      {open && (
        <Modal
          title="Hướng dẫn sử dụng"
          eyebrow="PULSE / TRỢ GIÚP"
          maxWidth={640}
          onClose={() => setOpen(false)}
        >
          <div className="help-panel">
            <p>
              Các bước thực hiện những công việc thường dùng trong không gian
              của bạn.
            </p>
            <label>
              Tìm hướng dẫn
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Ví dụ: lịch, gói, thanh toán…"
              />
            </label>
            <div className="help-topics">
              {rows.map((guide) => (
                <details key={guide.path}>
                  <summary>{guide.title}</summary>
                  <ol>
                    {guide.steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                  <Link
                    to={`${base}/${guide.path}`}
                    onClick={() => setOpen(false)}
                  >
                    Mở chức năng <ArrowUpRight size={16} />
                  </Link>
                </details>
              ))}
              {!rows.length && (
                <p role="status">
                  Không tìm thấy hướng dẫn. Thử từ khóa khác hoặc xóa nội dung
                  tìm kiếm.
                </p>
              )}
            </div>
            <details>
              <summary>Thao tác bàn phím và tin nhắn</summary>
              <ul>
                <li>
                  Tab để di chuyển giữa các điều khiển; Enter hoặc Space để kích
                  hoạt nút.
                </li>
                <li>Trong chat: Enter để gửi, Shift + Enter để xuống dòng.</li>
                <li>Bấm ảnh đã gửi để xem lớn; Esc để đóng cửa sổ xem ảnh.</li>
                <li>
                  Tệp đính kèm: JPEG, PNG, WebP, GIF hoặc PDF; tối đa 10 MB.
                </li>
              </ul>
            </details>
            <Link to={`${base}/policies`} onClick={() => setOpen(false)}>
              Xem chính sách sử dụng của trung tâm
            </Link>
          </div>
        </Modal>
      )}
    </>
  );
}
