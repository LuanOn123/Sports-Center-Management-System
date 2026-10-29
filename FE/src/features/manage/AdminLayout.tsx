import { PaymentsPage } from "../reception/payments/PaymentsPage";
import { MembershipInsightsPage } from "./MembershipInsightsPage";
import { Navigate, Route, Routes } from "react-router-dom";
import type { PortalProps } from "../../app/RoleRouter";
import { PortalLayout } from "../../shared/PortalLayout";
import { Profile } from "../../shared/Profile";
import { OperationsPage } from "../operations/OperationsPage";
import { ResourcePage } from "./ResourcePage";
import { resources } from "./config";
import { AdminDashboard } from "./AdminDashboard";
import { AdminFacilities } from "./AdminFacilities";
import { AdminTerms } from "./AdminTerms";
import { AuditLogPage } from "./AuditLogPage";
import { CoachChangesPage } from "../operations/CoachChangesPage";
const items = [
  ["dashboard", "Tổng quan"],
  ["membership-insights", "Nhu cầu gói & lớp"],
  ["payments", "Thanh toán & hoàn tiền"],
  ["facilities", "Cơ sở"],
  ["terms", "Kỳ học"],
  ["users", "Người dùng"],
  ["membership-plans", "Gói thành viên"],
  ["sports", "Bộ môn"],
  ["rooms", "Phòng tập"],
  ["classes", "Lớp học"],
  ["schedules", "Lịch hoạt động"],
  ["coach-changes", "Đổi HLV theo buổi"],
  ["leave", "Nghỉ học & nhân sự"],
  ["issues", "Yêu cầu hỗ trợ"],
  ["audit", "Nhật ký hoạt động"],
  ["profile", "Tài khoản của tôi"],
] as const;
export function AdminLayout(props: PortalProps) {
  return (
    <PortalLayout
      {...props}
      title="Quản trị hệ thống"
      base="/admin"
      items={items}
    >
      <Routes>
        <Route path="/admin/payments" element={<PaymentsPage role="ADMIN" />} />
        <Route
          path="/admin/membership-insights"
          element={<MembershipInsightsPage global />}
        />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route
          path="/admin/coach-changes"
          element={<CoachChangesPage role="ADMIN" />}
        />
        <Route path="/admin/facilities" element={<AdminFacilities />} />
        <Route path="/admin/terms" element={<AdminTerms />} />
        <Route path="/admin/audit" element={<AuditLogPage />} />
        {(["leave", "issues"] as const).map((kind) => (
          <Route
            key={kind}
            path={"/admin/" + kind}
            element={<OperationsPage kind={kind} role="ADMIN" />}
          />
        ))}
        {resources
          .filter((r) =>
            [
              "users",
              "membership-plans",
              "sports",
              "rooms",
              "classes",
              "schedules",
            ].includes(r.slug),
          )
          .map((r) => (
            <Route
              key={r.slug}
              path={"/admin/" + r.slug}
              element={
                <ResourcePage
                  key={r.slug}
                  resource={r}
                  role="ADMIN"
                  userId={props.user.id}
                />
              }
            />
          ))}
        <Route path="/admin/profile" element={<Profile user={props.user} />} />
        <Route
          path="/admin/staff"
          element={<Navigate replace to="/admin/facilities" />}
        />
        <Route
          path="/admin/members"
          element={<Navigate replace to="/admin/users?role=MEMBER" />}
        />
        {["coaches", "requirements", "slots", "patterns", "orders"].map(
          (slug) => (
            <Route
              key={slug}
              path={"/admin/" + slug}
              element={<Navigate replace to="/admin/dashboard" />}
            />
          ),
        )}
        <Route path="*" element={<Navigate replace to="/admin/dashboard" />} />
      </Routes>
    </PortalLayout>
  );
}
