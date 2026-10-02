import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  UserPlus,
  CreditCard,
  CalendarDays,
  Receipt,
  Users,
} from "lucide-react";
import { Heading, ListState, Table } from "../components";
import { useReceptionList } from "../api";
import { ScheduleAgenda } from "../../../shared/ScheduleAgenda";

const shortcuts = [
  {
    path: "members/create",
    title: "Đăng ký hội viên mới",
    description: "Tạo hồ sơ và bắt đầu hành trình tập luyện.",
    icon: UserPlus,
  },
  {
    path: "membership",
    title: "Đăng ký / gia hạn gói",
    description: "Kiểm tra quyền lợi và thời hạn gói tập.",
    icon: CreditCard,
  },
  {
    path: "classes",
    title: "Hỗ trợ đăng ký lớp",
    description: "Tìm buổi tập phù hợp cho hội viên.",
    icon: CalendarDays,
  },
  {
    path: "payments",
    title: "Thanh toán & hóa đơn",
    description: "Đối chiếu giao dịch và phát hành hóa đơn.",
    icon: Receipt,
  },
];
export function DashboardPage() {
  const members = useReceptionList("GET /members", { page: "1", limit: "5" });
  const now = new Date();
  const today = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
  const schedules = useReceptionList("GET /class-schedules", {
    date: today,
    page: "1",
    limit: "5",
  });
  return (
    <>
      <Heading title="Tổng quan lễ tân">
        <span className="date-label">
          <CalendarDays size={17} />
          {now.toLocaleDateString("vi-VN", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </span>
      </Heading>
      <section className="operations-welcome">
        <div>
          <span className="eyebrow">PULSE / FRONT DESK</span>
          <h2>
            Một khởi đầu tốt.
            <br />
            <em>Một trải nghiệm trọn vẹn.</em>
          </h2>
          <p>
            Sẵn sàng đón hội viên. Mọi công việc tại quầy, trong một không gian.
          </p>
        </div>
        <Link className="button lime" to="/receptionist/members">
          <Users size={18} />
          Tra cứu hội viên
          <ArrowUpRight size={18} />
        </Link>
      </section>
      <div className="shortcut-grid">
        {shortcuts.map(({ path, title, description, icon: Icon }) => (
          <Link
            className="shortcut-card"
            key={path}
            to={"/receptionist/" + path}
          >
            <span className="shortcut-icon">
              <Icon size={22} />
            </span>
            <ArrowUpRight className="shortcut-arrow" size={18} />
            <h3>{title}</h3>
            <p>{description}</p>
          </Link>
        ))}
      </div>
      <div className="operations-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">HÔM NAY</span>
              <h2>Nhịp tập luyện</h2>
            </div>
            <Link className="text-link" to="/receptionist/classes">
              Xem lịch
              <ArrowUpRight size={16} />
            </Link>
          </div>
          <ListState result={schedules}>
            {(rows) => (
              <ScheduleAgenda
                rows={rows}
                actions={() => (
                  <Link className="button small" to="/receptionist/classes">
                    Đăng ký lớp
                  </Link>
                )}
              />
            )}
          </ListState>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">CỘNG ĐỒNG</span>
              <h2>Danh sách hội viên</h2>
            </div>
          </div>
          <ListState result={members}>
            {(rows) => (
              <Table
                rows={rows}
                columns={[
                  ["user.fullName", "Hội viên"],
                  ["user.email", "Email"],
                  ["user.phone", "Điện thoại"],
                ]}
              />
            )}
          </ListState>
          <div className="panel-bottom">
            <Link className="text-link" to="/receptionist/members">
              Tra cứu tất cả hội viên
              <ArrowUpRight size={16} />
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
