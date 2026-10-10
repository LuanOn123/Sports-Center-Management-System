import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type RecordData } from "../../shared/api";
import { getFacilityId } from "../../shared/facility";
import { allPages } from "../../shared/pagedApi";
import { classSports } from "../../shared/sports";
import { canTeach } from "../../shared/coachEligibility";
import { Empty, ErrorState, Loading, Modal, SchemaForm } from "../../shared/ui";

type CoachSpecializationItem = {
  sport: { id: string; name: string };
};
type CoachProfileInfo = {
  id: string;
  specializations?: CoachSpecializationItem[];
};
type Staff = {
  id: string;
  fullName: string;
  email: string;
  role: string;
  coachProfile?: CoachProfileInfo | null;
};
type Assignment = {
  userId: string;
  role: string;
  isActive: boolean;
  user: Staff;
};
export function ManagerUsers() {
  const facilityId = getFacilityId();
  const cache = useQueryClient();
  const [view, setView] = useState("assigned");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [target, setTarget] = useState<Staff>();
  const [coach, setCoach] = useState<string>();
  const [showCreateCoach, setShowCreateCoach] = useState(false);
  const assigned = useQuery({
    queryKey: ["manager-staff", facilityId],
    queryFn: ({ signal }) =>
      api<{ name: string; staffs: Assignment[] }>(
        "GET /facilities/{facilityId}",
        { params: { facilityId }, signal },
      ),
  });
  const pool = useQuery({
    queryKey: ["manager-candidates", facilityId],
    queryFn: ({ signal }) => api<Staff[]>("GET /staff-candidates", { signal }),
    enabled: view !== "assigned",
  });
  const assign = useMutation({
    mutationFn: (user: Staff) =>
      api("POST /facilities/{facilityId}/staff", {
        params: { facilityId },
        body: { userId: user.id, role: user.role },
      }),
    onSuccess: async () => {
      setTarget(undefined);
      await cache.invalidateQueries();
    },
    onError: async () => {
      await cache.invalidateQueries({ queryKey: ["manager-candidates"] });
    },
  });
  const source = view === "assigned" ? assigned : pool;
  const rows =
    (view === "assigned"
      ? assigned.data?.data.staffs
          .filter(
            (s) => s.isActive && ["COACH", "RECEPTIONIST"].includes(s.role),
          )
          .map((s) => ({ ...s.user, role: s.role }))
      : pool.data?.data.filter((s) => s.role === view)) || [];
  const visible = rows.filter(
    (s) =>
      (!role || s.role === role) &&
      `${s.fullName} ${s.email}`
        .toLocaleLowerCase("vi")
        .includes(search.toLocaleLowerCase("vi")),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">QUẢN LÝ CƠ SỞ</span>
          <h1>Nhân sự cơ sở</h1>
          <p>
            {assigned.data?.data.name} · Phân công Coach và theo dõi nhân sự tại
            cơ sở bạn quản lý.
          </p>
        </div>
        <button
          className="button primary"
          onClick={() => setShowCreateCoach(true)}
        >
          + Tạo Huấn luyện viên
        </button>
      </div>
      <section className="panel">
        <div className="tabs">
          {[
            ["assigned", "Nhân sự cơ sở"],
            ["COACH", "Coach chưa phân công"],
          ].map(([key, text]) => (
            <button
              key={key}
              className={view === key ? "active" : ""}
              aria-pressed={view === key}
              onClick={() => {
                setView(key);
                setRole("");
              }}
            >
              {text}
            </button>
          ))}
        </div>
        <div className="filters">
          <label>
            Tìm nhân sự
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Họ tên hoặc email"
            />
          </label>
          {view === "assigned" && (
            <label>
              Vai trò
              <select value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="">Tất cả</option>
                <option value="COACH">Coach</option>
                <option value="RECEPTIONIST">Lễ tân</option>
              </select>
            </label>
          )}
        </div>
        {source.isPending ? (
          <Loading />
        ) : source.error ? (
          <ErrorState error={source.error} retry={() => source.refetch()} />
        ) : !visible.length ? (
          <Empty text="Không có nhân sự phù hợp" />
        ) : (
          <div className="table-scroll" tabIndex={0}>
            <table>
              <thead>
                <tr>
                  <th>Họ tên</th>
                  <th>Email</th>
                  <th>Vai trò</th>
                  <th>Bộ môn</th>
                  <th>Phân công</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((s) => (
                  <tr key={s.id}>
                    <td>{s.fullName}</td>
                    <td>{s.email}</td>
                    <td>{s.role === "COACH" ? "Coach" : "Lễ tân"}</td>
                    <td>
                      {s.role === "COACH" ? (
                        s.coachProfile?.specializations?.length ? (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                            {s.coachProfile.specializations.map((sp) => (
                              <span key={sp.sport.id} className="badge">
                                {sp.sport.name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="badge" style={{ opacity: 0.6 }}>Chưa có môn</span>
                        )
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      {view === "assigned" ? (
                        <>
                          <span className="badge">Đã phân công</span>
                          {s.role === "COACH" && (
                            <button
                              className="button small"
                              onClick={() => setCoach(s.id)}
                            >
                              Hồ sơ Coach
                            </button>
                          )}
                        </>
                      ) : (
                        <button
                          className="button primary"
                          onClick={() => {
                            assign.reset();
                            setTarget(s);
                          }}
                        >
                          Phân công vào cơ sở
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {target && (
        <Modal
          title="Xác nhận phân công"
          dismissible={!assign.isPending}
          onClose={() => setTarget(undefined)}
        >
          <div className="confirmation-body">
            <p>
              Phân công {target.fullName} vào {assigned.data?.data.name}. Nhân
              sự sẽ xuất hiện trong danh sách của cơ sở này.
            </p>
            {assign.error && <ErrorState error={assign.error} />}
            <div className="confirmation-actions">
              <button
                className="button"
                disabled={assign.isPending}
                onClick={() => setTarget(undefined)}
              >
                Hủy
              </button>
              <button
                className="button primary"
                disabled={assign.isPending}
                onClick={() => assign.mutate(target)}
              >
                {assign.isPending ? "Đang phân công…" : "Xác nhận phân công"}
              </button>
            </div>
          </div>
        </Modal>
      )}
      {showCreateCoach && (
        <CreateCoachModal onClose={() => setShowCreateCoach(false)} />
      )}
      {coach && <CoachEditor id={coach} onClose={() => setCoach(undefined)} />}
    </>
  );
}
function CoachEditor({ id, onClose }: { id: string; onClose: () => void }) {
  const cache = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("profile");
  const q = useQuery({
    queryKey: ["manager-coach", getFacilityId(), id],
    queryFn: ({ signal }) =>
      api<RecordData>("GET /coaches/{id}", { params: { id }, signal }),
  });
  const profile = q.data?.data.coachProfile as RecordData | undefined;
  return (
    <Modal title="Hồ sơ Coach" onClose={onClose} dismissible={!busy}>
      <div className="tabs">
        <button
          disabled={busy}
          aria-pressed={tab === "profile"}
          onClick={() => setTab("profile")}
        >
          Thông tin
        </button>
        <button
          disabled={busy}
          aria-pressed={tab === "sports"}
          onClick={() => setTab("sports")}
        >
          Bộ môn giảng dạy
        </button>
      </div>
      {q.isPending ? (
        <Loading />
      ) : q.error ? (
        <ErrorState error={q.error} retry={() => q.refetch()} />
      ) : (
        q.data &&
        (tab === "profile" ? (
          <SchemaForm
            operation="PATCH /coaches/{id}"
            params={{ id }}
            initial={{ ...q.data.data, ...profile }}
            onBusyChange={setBusy}
            onCancel={onClose}
            onSuccess={async () => {
              await cache.invalidateQueries();
              onClose();
            }}
          />
        ) : profile?.id ? (
          <CoachSports
            id={String(profile.id)}
            onClose={onClose}
            onBusy={setBusy}
          />
        ) : (
          <Empty text="Chưa có hồ sơ Coach" />
        ))
      )}
    </Modal>
  );
}

function CoachSports({
  id,
  onClose,
  onBusy,
}: {
  id: string;
  onClose: () => void;
  onBusy: (busy: boolean) => void;
}) {
  const query = useQuery({
    queryKey: ["manager-coach-sports", getFacilityId(), id],
    queryFn: async ({ signal }) => {
      const [sports, assigned, classes] = await Promise.all([
        allPages<{ id: string; name: string }>("GET /sports", { signal }),
        api<{ sportId: string }[]>("GET /coaches/{id}/specializations", {
          params: { id },
          signal,
        }),
        allPages<RecordData>("GET /classes", {
          query: { coachId: id },
          signal,
        }),
      ]);
      return {
        sports: sports.data,
        assigned: assigned.data.map((row) => row.sportId),
        requiredSports: classes.data
          .filter((row) => row.isActive !== false)
          .flatMap(classSports)
          .map((sport) => sport.id),
      };
    },
  });
  const [selection, setSelection] = useState<string[]>();
  const cache = useQueryClient();
  const selected = selection ?? query.data?.assigned ?? [];
  const coversClasses =
    !query.data?.requiredSports.length ||
    canTeach(query.data.requiredSports, selected);
  const save = useMutation({
    mutationFn: async () => {
      if (!coversClasses)
        throw new Error(
          "Không thể gỡ bộ môn của lớp HLV đang phụ trách. Hãy điều chỉnh phân công lớp trước.",
        );
      const currentClasses = await allPages<RecordData>("GET /classes", {
        query: { coachId: id },
      });
      const required = currentClasses.data
        .filter((row) => row.isActive !== false)
        .flatMap(classSports)
        .map((sport) => sport.id);
      if (required.length && !canTeach(required, selected))
        throw new Error(
          "Phân công lớp của HLV vừa thay đổi. Hãy tải lại và giữ các bộ môn của lớp đang phụ trách.",
        );
      return api("PUT /coaches/{id}/specializations", {
        params: { id },
        body: { sportIds: selected },
      });
    },
    onMutate: () => onBusy(true),
    onSettled: () => onBusy(false),
    onSuccess: async () => {
      await cache.invalidateQueries();
      onClose();
    },
  });
  if (query.isPending) return <Loading />;
  if (query.error)
    return <ErrorState error={query.error} retry={() => query.refetch()} />;
  return (
    <form
      className="manager-config-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (selected.length && coversClasses) save.mutate();
      }}
    >
      <p>
        Chọn một hoặc nhiều bộ môn HLV đủ điều kiện giảng dạy. HLV chỉ được phân
        công lớp và dạy thay trong các bộ môn này. Thông tin chuyên môn dạng mô
        tả không cấp quyền giảng dạy.
      </p>
      <fieldset disabled={save.isPending}>
        <legend>Bộ môn giảng dạy</legend>
        {query.data?.sports.map((s) => (
          <label key={s.id}>
            <input
              type="checkbox"
              checked={selected.includes(s.id)}
              onChange={(e) =>
                setSelection(
                  e.target.checked
                    ? [...selected, s.id]
                    : selected.filter((id) => id !== s.id),
                )
              }
            />
            {s.name}
          </label>
        ))}
        {!query.data?.sports.length && <Empty text="Chưa có bộ môn" />}
        {!coversClasses && (
          <p role="alert">
            Không thể gỡ bộ môn của lớp HLV đang phụ trách. Điều chỉnh phân công
            lớp trước khi bỏ bộ môn.
          </p>
        )}
        <div className="modal-footer">
          <button type="button" className="button" onClick={onClose}>
            Hủy
          </button>
          <button
            className="button primary"
            disabled={!selected.length || !coversClasses || save.isPending}
          >
            Lưu bộ môn
          </button>
        </div>
      </fieldset>
      {save.error && <ErrorState error={save.error} />}
    </form>
  );
}

function CreateCoachModal({ onClose }: { onClose: () => void }) {
  const facilityId = getFacilityId();
  const cache = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState<"MALE" | "FEMALE" | "OTHER">("MALE");
  const [experienceYears, setExperienceYears] = useState("");
  const [bio, setBio] = useState("");
  const [selectedSports, setSelectedSports] = useState<string[]>([]);
  const [error, setError] = useState<unknown>();

  const sportsQuery = useQuery({
    queryKey: ["all-sports"],
    queryFn: ({ signal }) =>
      allPages<{ id: string; name: string; isActive?: boolean }>("GET /sports", { signal }),
  });

  const activeSports = (sportsQuery.data?.data ?? []).filter(
    (s) => s.isActive !== false
  );

  const createCoach = useMutation({
    mutationFn: async () => {
      if (!selectedSports.length) {
        throw new Error("Bắt buộc chọn ít nhất một bộ môn.");
      }
      return api("POST /facilities/{facilityId}/coaches", {
        params: { facilityId },
        body: {
          fullName: fullName.trim(),
          email: email.trim(),
          password: password.trim() || undefined,
          phone: phone.trim() || undefined,
          gender,
          experienceYears: experienceYears ? Number(experienceYears) : undefined,
          bio: bio.trim() || undefined,
          sportIds: selectedSports,
        },
      });
    },
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: ["manager-staff", facilityId] });
      await cache.invalidateQueries({ queryKey: ["qualified-coaches"] });
      await cache.invalidateQueries({ queryKey: ["manager-candidates"] });
      onClose();
    },
    onError: (err) => {
      setError(err);
    },
  });

  const isValid =
    fullName.trim().length > 0 &&
    email.trim().length > 0 &&
    selectedSports.length > 0;

  return (
    <Modal title="Tạo Huấn luyện viên mới" onClose={onClose} dismissible={!createCoach.isPending}>
      <form
        className="manager-config-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (isValid && !createCoach.isPending) {
            setError(undefined);
            createCoach.mutate();
          }
        }}
      >
        <p className="field-note">
          Tạo tài khoản HLV mới cho cơ sở này. Bắt buộc chọn ít nhất 1 bộ môn giảng dạy.
        </p>

        {Boolean(error) && <ErrorState error={error} />}

        <div className="form-grid">
          <label>
            Họ và tên *
            <input
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Nguyễn Văn A"
            />
          </label>

          <label>
            Email *
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="coach@example.com"
            />
          </label>

          <label>
            Mật khẩu
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mặc định: Coach@123456"
            />
          </label>

          <label>
            Số điện thoại
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0901234567"
            />
          </label>

          <label>
            Giới tính
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value as any)}
            >
              <option value="MALE">Nam</option>
              <option value="FEMALE">Nữ</option>
              <option value="OTHER">Khác</option>
            </select>
          </label>

          <label>
            Số năm kinh nghiệm
            <input
              type="number"
              min="0"
              value={experienceYears}
              onChange={(e) => setExperienceYears(e.target.value)}
              placeholder="Ví dụ: 3"
            />
          </label>
        </div>

        <label style={{ display: "block", marginTop: "12px" }}>
          Giới thiệu / Tiểu sử
          <textarea
            rows={2}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Chứng chỉ, phong cách huấn luyện..."
          />
        </label>

        <fieldset style={{ marginTop: "16px" }} disabled={createCoach.isPending}>
          <legend>Bộ môn giảng dạy * (Bắt buộc chọn ít nhất 1 môn)</legend>
          {sportsQuery.isPending ? (
            <Loading />
          ) : !activeSports.length ? (
            <Empty text="Không có bộ môn khả dụng" />
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "8px", marginTop: "8px" }}>
              {activeSports.map((s) => (
                <label key={s.id} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <input
                    type="checkbox"
                    checked={selectedSports.includes(s.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedSports([...selectedSports, s.id]);
                      } else {
                        setSelectedSports(selectedSports.filter((id) => id !== s.id));
                      }
                    }}
                  />
                  {s.name}
                </label>
              ))}
            </div>
          )}
          {!selectedSports.length && (
            <p className="field-note" style={{ color: "var(--color-danger, #ef4444)", marginTop: "4px" }}>
              Vui lòng chọn ít nhất một bộ môn.
            </p>
          )}
        </fieldset>

        <div className="modal-footer" style={{ marginTop: "20px" }}>
          <button
            type="button"
            className="button"
            onClick={onClose}
            disabled={createCoach.isPending}
          >
            Hủy
          </button>
          <button
            type="submit"
            className="button primary"
            disabled={!isValid || createCoach.isPending}
          >
            {createCoach.isPending ? "Đang tạo…" : "Tạo Huấn luyện viên"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
