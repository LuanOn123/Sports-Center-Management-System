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
import { FacilityVisits } from "../../shared/FacilityVisits";
const items = [
  ["dashboard", "Tổng quan"],
  ["members", "Hội viên"],
  ["checkin", "Check-in cơ sở"],
  ["membership", "Gói thành viên"],
  ["orders", "Bán gói tại quầy"],
  ["classes", "Đăng ký lớp"],
  ["catalogue", "Quản lý lớp học"],
  ["schedules", "Lịch & điểm danh"],
  ["sports", "Bộ môn"],
  ["rooms", "Phòng tập"],
  ["payments", "Thanh toán & hóa đơn"],
  ["support", "Yêu cầu hỗ trợ"],
] as const;
export function ReceptionLayout(props: PortalProps) {
  return (
    <PortalLayout {...props} title="Lễ tân" base="/receptionist" items={items}>
      <Routes>
        <Route path="/receptionist/orders" element={<OperationsPage kind="orders" role="RECEPTIONIST" />} />
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
        <Route path="/receptionist/payments" element={<PaymentsPage />} />
        {resources
          .filter((r) =>
            ["sports", "rooms", "classes", "schedules"].includes(r.slug),
          )
          .map((r) => (
            <Route
              key={r.slug}
              path={`/receptionist/${r.slug === "classes" ? "catalogue" : r.slug}`}
              element={
                <ResourcePage
                  key={r.slug}
                  resource={r}
                  role="RECEPTIONIST"
                  userId={props.user.id}
                />
              }
            />
          ))}
        <Route
          path="/receptionist/checkin"
          element={
            <FacilityVisits staff />
          }
        />
        <Route
          path="/receptionist/support"
          element={
            <OperationsPage kind="issues" role="RECEPTIONIST" />
          }
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
