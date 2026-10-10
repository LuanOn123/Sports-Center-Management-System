import { AttendancePage } from "./attendance/AttendancePage";
import { OperationsPage } from "../operations/OperationsPage";
import { Navigate, Routes, Route } from "react-router-dom";
import type { PortalProps } from "../../app/RoleRouter";
import { PortalLayout } from "../../shared/PortalLayout";
import { Profile } from "../../shared/Profile";
import { Placeholder } from "../../shared/Placeholder";
import { DashboardPage } from "./dashboard/DashboardPage";
import { MembersPage, CreateMemberPage } from "./members/MembersPage";
import { MembershipPage } from "./membership/MembershipPage";
import { ClassesPage } from "./classes/ClassesPage";
import { PaymentsPage } from "./payments/PaymentsPage";
import { resources } from "../manage/config";
import { ResourcePage } from "../manage/ResourcePage";

const items = [
  ["dashboard", "Tổng quan"],
  ["members", "Hội viên"],
  ["attendance", "Chuyên cần"],
  ["membership", "Gói thành viên"],
  ["orders", "Bán gói tại quầy"],
  ["classes", "Đăng ký lớp"],
  ["schedules", "Lịch lớp học"],
  ["payments", "Thanh toán & hóa đơn"],
  ["support", "Yêu cầu hỗ trợ"],
] as const;

export function ReceptionLayout(props: PortalProps) {
  const schedulesResource = resources.find((r) => r.slug === "schedules")!;

  return (
    <PortalLayout {...props} title="Lễ tân" base="/receptionist" items={items}>
      <Routes>
        <Route path="/receptionist/attendance" element={<AttendancePage />} />
        <Route
          path="/receptionist/orders"
          element={<OperationsPage kind="orders" role="RECEPTIONIST" />}
        />
        <Route path="/receptionist/dashboard" element={<DashboardPage />} />
        <Route path="/receptionist/members" element={<MembersPage />} />
        <Route
          path="/receptionist/members/create"
          element={<CreateMemberPage />}
        />
        <Route path="/receptionist/membership" element={<MembershipPage />} />
        <Route path="/receptionist/classes" element={<ClassesPage />} />
        <Route
          path="/receptionist/activity-planner"
          element={<Navigate replace to="/receptionist/schedules" />}
        />
        <Route
          path="/receptionist/schedules"
          element={
            <ResourcePage
              resource={schedulesResource}
              role="RECEPTIONIST"
              userId={props.user.id}
            />
          }
        />
        <Route path="/receptionist/payments" element={<PaymentsPage />} />

        {/* Redirects for removed sections */}
        <Route
          path="/receptionist/checkin"
          element={<Navigate replace to="/receptionist/dashboard" />}
        />
        <Route
          path="/receptionist/catalogue"
          element={<Navigate replace to="/receptionist/classes" />}
        />
        <Route
          path="/receptionist/sports"
          element={<Navigate replace to="/receptionist/dashboard" />}
        />
        <Route
          path="/receptionist/rooms"
          element={<Navigate replace to="/receptionist/dashboard" />}
        />

        <Route
          path="/receptionist/support"
          element={<OperationsPage kind="issues" role="RECEPTIONIST" />}
        />
        <Route
          path="/receptionist/profile"
          element={<Profile user={props.user} />}
        />
        <Route
          path="*"
          element={<Placeholder title="Không tìm thấy trang" />}
        />
      </Routes>
    </PortalLayout>
  );
}
