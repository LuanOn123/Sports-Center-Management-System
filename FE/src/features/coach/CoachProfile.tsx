import { AvatarUploader } from "../../shared/Avatar";
import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../../shared/api";
import type { PortalProps } from "../../app/RoleRouter";
import { ErrorState } from "../../shared/ui";
import { Heading } from "./CoachWorkspace";
import { dateKey, obj, str, type Row } from "./data";
import { getFacilityId } from "../../shared/facility";
import { allPages } from "../../shared/pagedApi";
import type { CoachSpecialization } from "../../shared/coachEligibility";

export function validateCoachProfile(body: Row) {
  const errors: Record<string, string> = {};
  if (
    String(body.fullName || "").trim().length < 2 ||
    String(body.fullName).length > 100
  )
    errors.fullName = "Họ tên cần từ 2 đến 100 ký tự.";
  if (
    body.phone &&
    (!/^\+?[0-9]+$/.test(String(body.phone)) ||
      String(body.phone).length < 9 ||
      String(body.phone).length > 15)
  )
    errors.phone = "Nhập 9–15 ký tự, chỉ gồm chữ số và dấu + ở đầu nếu có.";
  if (
    body.dateOfBirth &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(String(body.dateOfBirth)) ||
      dateKey(body.dateOfBirth) !== body.dateOfBirth ||
      String(body.dateOfBirth) >= dateKey())
  )
    errors.dateOfBirth = "Ngày sinh phải hợp lệ và trước hôm nay.";
  return errors;
}
export function CoachProfile({ user }: Pick<PortalProps, "user">) {
  const client = useQueryClient();
  const formRef = useRef<HTMLFormElement>(null);
  const [tab, setTab] = useState("profile");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState("");
  const [show, setShow] = useState(false);
  const mutation = useMutation({
    mutationFn: ({ key, body }: { key: string; body: Row }) =>
      api(key, { body }),
    onSuccess: () => {
      if (tab === "password") return;
      setSuccess(tab === "profile" ? "Đã cập nhật hồ sơ." : "Đã đổi mật khẩu.");
      void client.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (e) => {
      if (e instanceof ApiError)
        setErrors(
          Object.fromEntries((e.errors || []).map((f) => [f.field, f.message])),
        );
    },
  });
  const coach = obj((user as unknown as Row).coachProfile);
  const assignedSports = useQuery({
    queryKey: ["coach-assigned-sports", getFacilityId(), coach.id],
    enabled: !!coach.id,
    queryFn: async ({ signal }) => {
      const [assigned, sports] = await Promise.all([
        api<CoachSpecialization[]>("GET /coaches/{id}/specializations", {
          params: { id: String(coach.id) },
          signal,
        }),
        allPages<{ id: string; name: string }>("GET /sports", { signal }),
      ]);
      return assigned.data.map(
        (item) =>
          sports.data.find((sport) => sport.id === item.sportId)?.name ||
          "Bộ môn chưa xác định",
      );
    },
  });
  return (
    <div className="coach-workspace">
      <Heading
        title="Tài khoản huấn luyện viên"
        description="Cập nhật thông tin liên hệ và bảo vệ tài khoản của bạn."
      />
      <div className="coach-profile-grid">
        <aside className="panel coach-profile-summary">
          <AvatarUploader user={user} />
          <h2>{user.fullName}</h2>
          <p>{user.email}</p>
          <span className="badge badge-neutral">Huấn luyện viên</span>
          <dl>
            <dt>Bộ môn được phép giảng dạy</dt>
            <dd>
              {assignedSports.isFetching
                ? "Đang tải…"
                : assignedSports.error
                  ? "Chưa tải được bộ môn"
                  : assignedSports.data?.join(" · ") ||
                    "Chưa được phân công bộ môn"}
            </dd>
            <dt>Mô tả chuyên môn</dt>
            <dd>{str(coach.specialization)}</dd>
            <dt>Kinh nghiệm</dt>
            <dd>
              {typeof coach.experienceYears === "number"
                ? `${coach.experienceYears} năm`
                : "Chưa cập nhật"}
            </dd>
          </dl>
          {assignedSports.error && (
            <ErrorState
              error={assignedSports.error}
              retry={() => assignedSports.refetch()}
            />
          )}
          <p>
            {str(
              coach.bio,
              "Liên hệ quản lý khi cần cập nhật chuyên môn hoặc kinh nghiệm giảng dạy.",
            )}
          </p>
        </aside>
        <section className="panel coach-profile-form">
          <div className="tabs">
            {[
              ["profile", "Hồ sơ"],
              ["password", "Đổi mật khẩu"],
            ].map(([v, t]) => (
              <button
                key={v}
                className={tab === v ? "active" : ""}
                aria-pressed={tab === v}
                disabled={mutation.isPending}
                onClick={() => {
                  setTab(v);
                  setSuccess("");
                  setErrors({});
                  mutation.reset();
                }}
              >
                {t}
              </button>
            ))}
          </div>
          {tab === "password" && (
            <p>Đổi mật khẩu sẽ đăng xuất khỏi tất cả thiết bị.</p>
          )}
          <form
            key={tab}
            ref={formRef}
            className="coach-form"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              if (mutation.isPending) return;
              const f = new FormData(e.currentTarget);
              setSuccess("");
              let body: Row;
              if (tab === "profile") {
                const phone = String(f.get("phone") || "").trim();
                body = {
                  fullName: String(f.get("fullName") || "").trim(),
                  ...(phone ? { phone } : {}),
                  ...(f.get("dateOfBirth")
                    ? { dateOfBirth: String(f.get("dateOfBirth")) }
                    : {}),
                  ...(f.get("gender")
                    ? { gender: String(f.get("gender")) }
                    : {}),
                };
                const next = validateCoachProfile(body);
                if (Object.keys(next).length) {
                  setErrors(next);
                  return;
                }
              } else {
                const currentPassword = String(f.get("currentPassword") || ""),
                  newPassword = String(f.get("newPassword") || "");
                const next: Record<string, string> = {};
                if (!currentPassword)
                  next.currentPassword = "Nhập mật khẩu hiện tại.";
                if (newPassword.length < 6)
                  next.newPassword = "Mật khẩu mới cần ít nhất 6 ký tự.";
                if (newPassword === currentPassword)
                  next.newPassword =
                    "Mật khẩu mới phải khác mật khẩu hiện tại.";
                if (newPassword !== f.get("confirmPassword"))
                  next.confirmPassword = "Mật khẩu xác nhận chưa khớp.";
                if (Object.keys(next).length) {
                  setErrors(next);
                  return;
                }
                body = { currentPassword, newPassword };
              }
              setErrors({});
              mutation.mutate({
                key:
                  tab === "profile"
                    ? "PATCH /auth/me"
                    : "PATCH /auth/me/change-password",
                body,
              });
            }}
          >
            <fieldset disabled={mutation.isPending}>
              <legend>
                {tab === "profile" ? "Thông tin cá nhân" : "Bảo mật tài khoản"}
              </legend>
              {tab === "profile" ? (
                <>
                  <Field name="fullName" label="Họ và tên" errors={errors}>
                    <input
                      id="fullName"
                      name="fullName"
                      defaultValue={user.fullName}
                      autoComplete="name"
                      maxLength={100}
                      required
                      aria-invalid={!!errors.fullName}
                      aria-describedby={
                        errors.fullName ? "fullName-error" : undefined
                      }
                    />
                  </Field>
                  <label>
                    Email
                    <input value={user.email} readOnly type="email" />
                    <small>Email đăng nhập do hệ thống quản lý.</small>
                  </label>
                  <Field name="phone" label="Số điện thoại" errors={errors}>
                    <input
                      id="phone"
                      name="phone"
                      defaultValue={user.phone || ""}
                      autoComplete="tel"
                      inputMode="tel"
                      maxLength={15}
                      aria-invalid={!!errors.phone}
                      aria-describedby={
                        errors.phone ? "phone-error" : "coach-phone-help"
                      }
                    />
                    <small id="coach-phone-help">
                      9–15 ký tự, ví dụ 0901234567. Để trống giữ thông tin hiện
                      có.
                    </small>
                  </Field>
                  <div className="coach-two">
                    <Field name="dateOfBirth" label="Ngày sinh" errors={errors}>
                      <input
                        id="dateOfBirth"
                        type="date"
                        name="dateOfBirth"
                        defaultValue={
                          user.dateOfBirth ? dateKey(user.dateOfBirth) : ""
                        }
                        aria-invalid={!!errors.dateOfBirth}
                        aria-describedby={
                          errors.dateOfBirth ? "dateOfBirth-error" : undefined
                        }
                      />
                    </Field>
                    <label>
                      Giới tính
                      <select name="gender" defaultValue={user.gender || ""}>
                        <option value="">Chưa cập nhật</option>
                        <option value="MALE">Nam</option>
                        <option value="FEMALE">Nữ</option>
                        <option value="OTHER">Khác</option>
                      </select>
                    </label>
                  </div>
                </>
              ) : (
                <>
                  {[
                    ["currentPassword", "Mật khẩu hiện tại"],
                    ["newPassword", "Mật khẩu mới"],
                    ["confirmPassword", "Xác nhận mật khẩu mới"],
                  ].map(([name, label]) => (
                    <Field key={name} name={name} label={label} errors={errors}>
                      <input
                        id={name}
                        name={name}
                        type={show ? "text" : "password"}
                        required
                        autoComplete={
                          name === "currentPassword"
                            ? "current-password"
                            : "new-password"
                        }
                        aria-invalid={!!errors[name]}
                        aria-describedby={
                          errors[name] ? `${name}-error` : undefined
                        }
                      />
                    </Field>
                  ))}
                  <label className="coach-checkbox">
                    <input
                      type="checkbox"
                      checked={show}
                      onChange={(e) => setShow(e.target.checked)}
                    />{" "}
                    Hiện mật khẩu
                  </label>
                </>
              )}
              {mutation.error && <ErrorState error={mutation.error} />}
              <button className="button primary" disabled={mutation.isPending}>
                {mutation.isPending ? "Đang lưu…" : "Lưu thay đổi"}
              </button>
            </fieldset>
          </form>
          {success && (
            <p role="status" className="success">
              {success}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
function Field({
  name,
  label,
  errors,
  children,
}: {
  name: string;
  label: string;
  errors: Record<string, string>;
  children: React.ReactNode;
}) {
  return (
    <div className="coach-field">
      <label htmlFor={name}>{label}</label>
      {children}
      {errors[name] && (
        <small id={`${name}-error`} className="error" role="alert">
          {errors[name]}
        </small>
      )}
    </div>
  );
}
