import { Route, Routes } from "react-router-dom";
import type { PortalProps } from "../../app/RoleRouter";
import { PortalLayout } from "../../shared/PortalLayout";
import { Placeholder } from "../../shared/Placeholder";
const items = [
  ["dashboard", "Tổng quan hội viên"],
  ["membership", "Gói thành viên"],
  ["schedule", "Lịch tập"],
  ["profile", "Tài khoản"],
] as const;
export function UserLayout(props: PortalProps) {
  return (
    <PortalLayout {...props} title="Hội viên" base="/user" items={items}>
      <Routes>
        {items.map(([path, title]) => (
          <Route
            key={path}
            path={"/user/" + path}
            element={<Placeholder title={title} />}
          />
        ))}
        <Route
          path="*"
          element={<Placeholder title="Không tìm thấy trang" />}
        />
      </Routes>
    </PortalLayout>
  );
}
