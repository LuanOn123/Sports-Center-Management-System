import { Link, Navigate, Route, Routes } from "react-router-dom";
import {
  CalendarDays,
  ChartNoAxesCombined,
  LayoutDashboard,
  Users,
  Warehouse,
  Trophy,
  ClipboardList,
  Dumbbell,
} from "lucide-react";
import type { ProfileOk } from "../../shared/generated";
import { PortalLayout, type NavigationGroup } from "../../shared/PortalLayout";
import { Profile } from "../../shared/Profile";
import { OperationsPage } from "../operations/OperationsPage";
import { resources } from "./config";
import { ResourcePage } from "./ResourcePage";
import { ManagerUsers } from "./ManagerUsers";
import { ManagerRooms } from "./ManagerRooms";
import { ManagerOverview } from "./ManagerOverview";
import "./manager.css";

const groups: NavigationGroup[] = [
  { title: "TỔNG QUAN", items: [["dashboard", "Tổng quan", LayoutDashboard]] },
  {
    title: "QUẢN LÝ CƠ SỞ",
    items: [
      ["users", "Nhân sự cơ sở", Users],
      ["coaches", "Huấn luyện viên", Dumbbell],
      ["rooms", "Phòng tập", Warehouse],
      ["classes", "Lớp học", Trophy],
      ["schedules", "Lịch hoạt động", CalendarDays],
    ],
  },
  {
    title: "ĐIỀU PHỐI",
    items: [
      ["leave", "Nghỉ phép", CalendarDays],
      ["issues", "Yêu cầu hỗ trợ", ClipboardList],
    ],
  },
  {
    title: "TÀI CHÍNH",
    items: [["reports", "Báo cáo doanh thu", ChartNoAxesCombined]],
  },
];
const redirects: Record<string, string> = {
  members: "users",
  staff: "users",
  sports: "classes",
  bookings: "classes",
  checkin: "dashboard",
  "audit-logs": "dashboard",
  requirements: "rooms",
  slots: "schedules",
  patterns: "schedules",
  roles: "users",
  "membership-plans": "reports",
  membership: "reports",
  payments: "reports",
  "activity-planner": "schedules",
  "attendance-rules": "classes",
};
export function ManagerLayout({
  user,
  onLogout,
}: {
  user: ProfileOk["data"];
  onLogout: () => Promise<void>;
}) {
  return (
    <PortalLayout
      user={user}
      onLogout={onLogout}
      title="Quản lý cơ sở"
      base="/manager"
      items={[]}
      groups={groups}
    >
      <Routes>
        <Route path="/manager/dashboard" element={<ManagerOverview />} />
        <Route path="/manager/reports" element={<ManagerOverview reports />} />
        <Route path="/manager/users" element={<ManagerUsers />} />
        <Route
          path="/manager/coaches"
          element={<ManagerUsers initialRole="COACH" />}
        />
        <Route
          path="/manager/rooms"
          element={<ManagerRooms userId={user.id} />}
        />
        {resources
          .filter((r) => ["classes", "schedules"].includes(r.slug))
          .map((r) => (
            <Route
              key={r.slug}
              path={`/manager/${r.slug}`}
              element={
                <ResourcePage resource={r} userId={user.id} role="MANAGER" />
              }
            />
          ))}
        {(["leave", "issues"] as const).map((kind) => (
          <Route
            key={kind}
            path={`/manager/${kind}`}
            element={<OperationsPage key={kind} kind={kind} role="MANAGER" />}
          />
        ))}
        <Route path="/manager/profile" element={<Profile user={user} />} />
        {Object.entries(redirects).map(([old, target]) => (
          <Route
            key={old}
            path={`/manager/${old}/*`}
            element={<Navigate replace to={`/manager/${target}`} />}
          />
        ))}
        {["/", "/manager", "/login"].map((path) => (
          <Route
            key={path}
            path={path}
            element={<Navigate replace to="/manager/dashboard" />}
          />
        ))}
        <Route
          path="*"
          element={
            <div className="fullscreen">
              <h1>Không tìm thấy trang</h1>
              <Link className="button primary" to="/manager/dashboard">
                Về tổng quan
              </Link>
            </div>
          }
        />
      </Routes>
    </PortalLayout>
  );
}
