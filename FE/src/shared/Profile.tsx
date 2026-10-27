import { Avatar, AvatarUploader } from "./Avatar";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { SchemaForm } from "./ui";
import type { ProfileOk } from "./generated";
import { display } from "./config";
import "./profile-menu.css";
export function Profile({
  user,
  explicitEditing = false,
}: {
  user: ProfileOk["data"];
  explicitEditing?: boolean;
}) {
  const client = useQueryClient();
  const [tab, setTab] = useState("profile");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">TÀI KHOẢN CỦA BẠN</div>
          <h1>Thông tin cá nhân</h1>
          <p>Quản lý hồ sơ và bảo mật tài khoản.</p>
        </div>
      </div>
      <div className="tabs" aria-label="Thông tin tài khoản">
        <button
          className={tab === "profile" ? "active" : ""}
          aria-pressed={tab === "profile"}
          disabled={busy}
          onClick={() => {
            setTab("profile");
            setEditing(false);
            setSuccess("");
          }}
        >
          Hồ sơ
        </button>
        <button
          className={tab === "password" ? "active" : ""}
          aria-pressed={tab === "password"}
          disabled={busy}
          onClick={() => {
            setTab("password");
            setEditing(false);
            setSuccess("");
          }}
        >
          Đổi mật khẩu
        </button>
      </div>
      {tab === "profile" && (!explicitEditing || editing) && (
        <AvatarUploader user={user} />
      )}
      <section className="panel profile-panel">
        {success && (
          <div className="success" role="status">
            {success}
          </div>
        )}
        {tab === "password" && (
          <p>Đổi mật khẩu sẽ đăng xuất khỏi tất cả thiết bị.</p>
        )}
        {explicitEditing && tab === "profile" && !editing ? (
          <div className="member-profile-overview">
            <div className="member-profile-overview-head">
              <div>
                <Avatar user={user} interactive={false} />
                <div>
                  <h2>{user.fullName}</h2>
                  <p>{user.role === "STAFF" ? "Lễ tân" : display(user.role)}</p>
                </div>
              </div>
              <button
                className="button primary"
                onClick={() => {
                  setEditing(true);
                  setSuccess("");
                }}
              >
                Chỉnh sửa thông tin
              </button>
            </div>
            <dl className="member-profile-facts">
              <div>
                <dt>Email</dt>
                <dd>{user.email}</dd>
              </div>
              <div>
                <dt>Số điện thoại</dt>
                <dd>{user.phone || "Chưa cập nhật"}</dd>
              </div>
              <div>
                <dt>Ngày sinh</dt>
                <dd>
                  {user.dateOfBirth
                    ? new Intl.DateTimeFormat("vi-VN", {
                        timeZone: "Asia/Ho_Chi_Minh",
                      }).format(new Date(user.dateOfBirth))
                    : "Chưa cập nhật"}
                </dd>
              </div>
              <div>
                <dt>Giới tính</dt>
                <dd>{user.gender ? display(user.gender) : "Chưa cập nhật"}</dd>
              </div>
            </dl>
          </div>
        ) : (
          <SchemaForm
            key={tab}
            operation={
              tab === "profile"
                ? "PATCH /auth/me"
                : "PATCH /auth/me/change-password"
            }
            initial={tab === "profile" ? user : {}}
            onBusyChange={setBusy}
            onSuccess={() => {
              if (tab === "password") return;
              setSuccess("Cập nhật thành công.");
              setEditing(false);
              void client.invalidateQueries({ queryKey: ["me"] });
            }}
            onCancel={() => {
              setTab("profile");
              setEditing(false);
            }}
          />
        )}
      </section>
    </>
  );
}
