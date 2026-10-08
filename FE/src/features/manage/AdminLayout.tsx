import { Navigate, Route, Routes } from "react-router-dom";
import type { PortalProps } from "../../app/RoleRouter";
import { PortalLayout } from "../../shared/PortalLayout";
import { Profile } from "../../shared/Profile";
import { OperationsPage } from "../operations/OperationsPage";
import { ResourcePage } from "./ResourcePage";
import { resources } from "./config";
import { AdminDashboard } from "./AdminDashboard";
import { AdminFacilities } from "./AdminFacilities";
import { AuditLogPage } from "./AuditLogPage";
const items = [
  ["dashboard", "Tổng quan"],
  ["facilities", "Cơ sở"],
  ["users", "Người dùng"],
  ["membership-plans", "Gói thành viên"],
  ["sports", "Bộ môn"],
  ["rooms", "Phòng tập"],
  ["classes", "Lớp học"],
  ["schedules", "Lịch hoạt động"],
  ["leave", "Nghỉ phép"],
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
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/admin/facilities" element={<AdminFacilities />} />
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
