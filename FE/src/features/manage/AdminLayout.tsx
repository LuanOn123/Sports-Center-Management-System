import { Route, Routes } from "react-router-dom";
import type { PortalProps } from "../../app/RoleRouter";
import { PortalLayout } from "../../shared/PortalLayout";
import { Profile } from "../../shared/Profile";
import { OperationsPage } from "../operations/OperationsPage";
import { ResourcePage } from "./ResourcePage";
import { resources } from "./config";
import { Dashboard } from "./Dashboard";
const items = [
  ["dashboard", "Tổng quan"],
  ["facilities", "Cơ sở"],
  ["staff", "Phân công nhân sự"],
  ["users", "Tài khoản"],
  ["membership-plans", "Gói thành viên"],
  ["sports", "Bộ môn"],
  ["coaches", "Huấn luyện viên"],
  ["rooms", "Phòng tập"],
  ["classes", "Lớp học"],
  ["schedules", "Lịch học"],
  ["requirements", "Điều kiện giảng dạy"],
  ["slots", "Khung giờ"],
  ["patterns", "Sinh lịch định kỳ"],
  ["leave", "Nghỉ phép"],
  ["orders", "Bán gói tại quầy"],
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
        <Route path="/admin/dashboard" element={<Dashboard />} />
        {(
          [
            "facilities",
            "staff",
            "requirements",
            "slots",
            "patterns",
            "leave",
            "orders",
            "issues",
            "audit",
          ] as const
        ).map((kind) => (
          <Route
            key={kind}
            path={"/admin/" + kind}
            element={<OperationsPage kind={kind} role="ADMIN" />}
          />
        ))}
        {resources
          .filter((r) => r.slug !== "staff")
          .map((r) => (
            <Route
              key={r.slug}
              path={"/admin/" + r.slug}
              element={
                <ResourcePage
                  resource={r}
                  role="ADMIN"
                  userId={props.user.id}
                />
              }
            />
          ))}
        <Route path="/admin/profile" element={<Profile user={props.user} />} />
      </Routes>
    </PortalLayout>
  );
}
