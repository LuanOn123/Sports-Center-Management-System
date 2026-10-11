import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  Plus,
  UserRound,
  MapPin,
  Pencil,
  UserPlus,
  Dumbbell,
} from "lucide-react";
import { api } from "../../shared/api";
import { allPages } from "../../shared/pagedApi";
import { Empty, ErrorState, Loading, Modal, SchemaForm } from "../../shared/ui";
import "./admin.css";

type CoachSpecialization = {
  sport: { id: string; name: string };
};
type CoachProfile = {
  id: string;
  specialization?: string | null;
  experienceYears?: number | null;
  bio?: string | null;
  specializations?: CoachSpecialization[];
};
type StaffUser = {
  id: string;
  fullName: string;
  email: string;
  role?: string;
  coachProfile?: CoachProfile | null;
};
type Staff = {
  userId: string;
  role: string;
  isActive: boolean;
  user: StaffUser;
};
type Manager = Staff;
type Facility = {
  id: string;
  name: string;
  code: string;
  address: string;
  contactInfo?: string;
  isActive: boolean;
  staffs: Staff[];
};
type Candidate = {
  id: string;
  fullName: string;
  email: string;
  role: string;
  coachProfile?: CoachProfile | null;
};

export function AdminFacilities() {
  const cache = useQueryClient();
  const [edit, setEdit] = useState<Facility | "create">();
  const [assignment, setAssignment] = useState<{
    facility: Facility;
    replaced?: Manager;
  }>();
  const [userId, setUserId] = useState("");
  const [createUser, setCreateUser] = useState(false);

  // Coach assignment state
  const [coachAssignment, setCoachAssignment] = useState<Facility>();
  const [coachUserId, setCoachUserId] = useState("");
  const [showCreateCoach, setShowCreateCoach] = useState<Facility>();

  const facilities = useQuery({
    queryKey: ["admin-facilities"],
    queryFn: ({ signal }) =>
      api<Facility[]>("GET /facilities", {
        query: { includeInactive: "true" },
        signal,
      }),
  });

  const candidates = useQuery({
    queryKey: ["manager-candidates"],
    queryFn: ({ signal }) =>
      api<Candidate[]>("GET /staff-candidates", { signal }),
    enabled: Boolean(assignment),
  });

  // Coach candidates (COACH users not assigned to any facility)
  const coachCandidates = useQuery({
    queryKey: ["coach-candidates"],
    queryFn: ({ signal }) =>
      api<Candidate[]>("GET /staff-candidates", {
        query: { role: "COACH" },
        signal,
      }),
    enabled: Boolean(coachAssignment),
  });

  const save = useMutation({
    mutationFn: () =>
      api("PUT /facilities/{facilityId}/manager", {
        params: { facilityId: assignment!.facility.id },
        body: {
          userId,
          ...(assignment?.replaced
            ? { replacedUserId: assignment.replaced.userId }
            : {}),
        },
      }),
    onSuccess: () => {
      setAssignment(undefined);
      setUserId("");
      void cache.invalidateQueries();
    },
  });

  const [removing, setRemoving] = useState<{
    facility: Facility;
    manager: Manager;
  }>();
  const remove = useMutation({
    mutationFn: () =>
      api("DELETE /facilities/{facilityId}/staff/{userId}/{role}", {
        params: {
          facilityId: removing!.facility.id,
          userId: removing!.manager.userId,
          role: "MANAGER",
        },
      }),
    onSuccess: () => {
      setRemoving(undefined);
      void cache.invalidateQueries();
    },
  });

  // Assign existing coach to facility
  const assignCoach = useMutation({
    mutationFn: () =>
      api("POST /facilities/{facilityId}/staff", {
        params: { facilityId: coachAssignment!.id },
        body: { userId: coachUserId, role: "COACH" },
      }),
    onSuccess: () => {
      setCoachAssignment(undefined);
      setCoachUserId("");
      void cache.invalidateQueries();
    },
  });

  // Remove coach from facility
  const [removingCoach, setRemovingCoach] = useState<{
    facility: Facility;
    coach: Staff;
  }>();
  const removeCoach = useMutation({
    mutationFn: () =>
      api("DELETE /facilities/{facilityId}/staff/{userId}/{role}", {
        params: {
          facilityId: removingCoach!.facility.id,
          userId: removingCoach!.coach.userId,
          role: "COACH",
        },
      }),
    onSuccess: () => {
      setRemovingCoach(undefined);
      void cache.invalidateQueries();
    },
  });

  const openAssignment = (facility: Facility, replaced?: Manager) => {
    save.reset();
    setUserId("");
    setAssignment({ facility, replaced });
  };

  const getManagers = (f: Facility) =>
    f.staffs?.filter((s) => s.role === "MANAGER") || [];
  const getCoaches = (f: Facility) =>
    f.staffs?.filter((s) => s.role === "COACH") || [];

  return (
    <div className="workflow-page admin-workspace">
      <div className="page-heading">
        <div>
          <div className="eyebrow">MẠNG LƯỚI TRUNG TÂM</div>
          <h1>Quản lý cơ sở</h1>
          <p>
            Thông tin cơ sở, đội ngũ quản lý và huấn luyện viên phụ trách trong
            cùng một nơi.
          </p>
        </div>
        <button className="button primary" onClick={() => setEdit("create")}>
          <Plus size={18} />
          Thêm cơ sở
        </button>
      </div>
      {facilities.isPending ? (
        <Loading />
      ) : facilities.isError ? (
        <ErrorState
          error={facilities.error}
          retry={() => facilities.refetch()}
        />
      ) : !facilities.data.data.length ? (
        <Empty text="Chưa có cơ sở." />
      ) : (
        <div className="admin-facility-grid">
          {facilities.data.data.map((f) => (
            <article className="panel admin-facility-card" key={f.id}>
              <div className="panel-heading">
                <span className="admin-card-icon">
                  <Building2 size={24} />
                </span>
                <span className={`badge ${f.isActive ? "success" : "muted"}`}>
                  {f.isActive ? "Đang hoạt động" : "Ngừng hoạt động"}
                </span>
              </div>
              <small className="eyebrow">{f.code}</small>
              <h2>{f.name}</h2>
              <p className="admin-address">
                <MapPin size={16} />
                {f.address}
              </p>
              {f.contactInfo && <p>{f.contactInfo}</p>}

              {/* Manager section */}
              <div className="admin-manager-list">
                <h3>
                  <UserRound size={17} />
                  Quản lý phụ trách
                </h3>
                {!getManagers(f).length ? (
                  <p className="field-note">Chưa phân công quản lý.</p>
                ) : (
                  getManagers(f).map((m) => (
                    <div className="admin-manager-row" key={m.userId}>
                      <div>
                        <strong>{m.user.fullName}</strong>
                        <small>{m.user.email}</small>
                      </div>
                      <div className="workflow-actions">
                        <button
                          className="button small"
                          disabled={!f.isActive}
                          onClick={() => openAssignment(f, m)}
                        >
                          Thay quản lý
                        </button>
                        <button
                          className="text-button danger-text"
                          onClick={() => {
                            remove.reset();
                            setRemoving({ facility: f, manager: m });
                          }}
                        >
                          Gỡ
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Coach section */}
              <div className="admin-coach-list">
                <h3>
                  <Dumbbell size={17} />
                  Huấn luyện viên
                  {getCoaches(f).length > 0 && (
                    <span className="admin-coach-count">
                      {getCoaches(f).length}
                    </span>
                  )}
                </h3>
                {!getCoaches(f).length ? (
                  <p className="field-note">Chưa có HLV tại cơ sở này.</p>
                ) : (
                  getCoaches(f).map((c) => (
                    <div className="admin-coach-row" key={c.userId}>
                      <div className="admin-coach-info">
                        <strong>{c.user.fullName}</strong>
                        <small>{c.user.email}</small>
                        {c.user.coachProfile?.specializations?.length ? (
                          <div className="admin-coach-sports">
                            {c.user.coachProfile.specializations.map((s) => (
                              <span
                                className="admin-sport-tag"
                                key={s.sport.id}
                              >
                                {s.sport.name}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      <button
                        className="text-button danger-text"
                        onClick={() => {
                          removeCoach.reset();
                          setRemovingCoach({ facility: f, coach: c });
                        }}
                      >
                        Gỡ
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div className="admin-card-footer">
                <button className="button" onClick={() => setEdit(f)}>
                  <Pencil size={16} />
                  Chỉnh sửa
                </button>
                <button
                  className="button"
                  disabled={!f.isActive}
                  onClick={() => openAssignment(f)}
                >
                  <UserPlus size={16} />
                  Thêm quản lý
                </button>
                <button
                  className="button"
                  disabled={!f.isActive}
                  onClick={() => {
                    assignCoach.reset();
                    setCoachUserId("");
                    setCoachAssignment(f);
                  }}
                >
                  <Dumbbell size={16} />
                  Thêm HLV
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Edit / Create Facility Modal */}
      {edit && (
        <Modal
          title={edit === "create" ? "Thêm cơ sở" : `Chỉnh sửa · ${edit.name}`}
          onClose={() => setEdit(undefined)}
        >
          <SchemaForm
            operation={
              edit === "create"
                ? "POST /facilities"
                : "PUT /facilities/{facilityId}"
            }
            params={edit === "create" ? {} : { facilityId: edit.id }}
            initial={edit === "create" ? {} : edit}
            onCancel={() => setEdit(undefined)}
            onSuccess={() => {
              setEdit(undefined);
              void cache.invalidateQueries();
            }}
          />
        </Modal>
      )}

      {/* Assign Manager Modal */}
      {assignment && !createUser && (
        <Modal
          title={`${assignment.replaced ? "Thay" : "Thêm"} quản lý · ${assignment.facility.name}`}
          dismissible={!save.isPending}
          onClose={() => setAssignment(undefined)}
        >
          <p>
            {assignment.replaced
              ? `Thay ${assignment.replaced.user.fullName} bằng một quản lý chưa được gán cơ sở. Phân công cũ chỉ được gỡ khi phân công mới thành công.`
              : "Chỉ chọn quản lý đang hoạt động và chưa được phân công vào cơ sở nào."}
          </p>
          {candidates.isPending ? (
            <Loading />
          ) : candidates.error ? (
            <ErrorState
              error={candidates.error}
              retry={() => candidates.refetch()}
            />
          ) : (
            <label>
              Quản lý
              <select
                value={userId}
                disabled={save.isPending}
                onChange={(event) => setUserId(event.target.value)}
              >
                <option value="">Chọn quản lý</option>
                {candidates.data?.data
                  .filter((c) => c.role === "MANAGER")
                  .map((c) => (
                    <option value={c.id} key={c.id}>
                      {c.fullName} · {c.email}
                    </option>
                  ))}
              </select>
            </label>
          )}
          <button
            className="text-button"
            disabled={save.isPending}
            onClick={() => setCreateUser(true)}
          >
            Tạo tài khoản quản lý mới
          </button>
          {save.error && <ErrorState error={save.error} />}
          <div className="modal-footer">
            <button
              className="button"
              disabled={save.isPending}
              onClick={() => setAssignment(undefined)}
            >
              Quay lại
            </button>
            <button
              className="button primary"
              disabled={!userId || save.isPending}
              onClick={() => save.mutate()}
            >
              {save.isPending ? "Đang lưu…" : "Lưu phân công"}
            </button>
          </div>
        </Modal>
      )}

      {/* Create Manager User Modal */}
      {createUser && (
        <Modal
          title="Tạo tài khoản quản lý"
          onClose={() => setCreateUser(false)}
        >
          <SchemaForm
            operation="POST /users"
            fixed={{ role: "MANAGER" }}
            onCancel={() => setCreateUser(false)}
            onSuccess={() => {
              setCreateUser(false);
              void cache.invalidateQueries({
                queryKey: ["manager-candidates"],
              });
            }}
          />
        </Modal>
      )}

      {/* Remove Manager Modal */}
      {removing && (
        <Modal
          title="Gỡ phân công quản lý"
          dismissible={!remove.isPending}
          onClose={() => setRemoving(undefined)}
        >
          <p>
            Gỡ {removing.manager.user.fullName} khỏi {removing.facility.name}?
            Tài khoản vẫn được giữ trong danh sách người dùng.
          </p>
          {remove.error && <ErrorState error={remove.error} />}
          <div className="modal-footer">
            <button
              className="button"
              disabled={remove.isPending}
              onClick={() => setRemoving(undefined)}
            >
              Quay lại
            </button>
            <button
              className="button danger"
              disabled={remove.isPending}
              onClick={() => remove.mutate()}
            >
              Gỡ phân công
            </button>
          </div>
        </Modal>
      )}

      {/* Assign Coach Modal */}
      {coachAssignment && !showCreateCoach && (
        <Modal
          title={`Thêm HLV · ${coachAssignment.name}`}
          dismissible={!assignCoach.isPending}
          onClose={() => setCoachAssignment(undefined)}
        >
          <p>
            Chọn huấn luyện viên chưa được phân công vào cơ sở nào. Hoặc tạo
            tài khoản HLV mới.
          </p>
          {coachCandidates.isPending ? (
            <Loading />
          ) : coachCandidates.error ? (
            <ErrorState
              error={coachCandidates.error}
              retry={() => coachCandidates.refetch()}
            />
          ) : !coachCandidates.data?.data.length ? (
            <p className="field-note">
              Không có HLV chưa phân công. Hãy tạo HLV mới bên dưới.
            </p>
          ) : (
            <label>
              Huấn luyện viên
              <select
                value={coachUserId}
                disabled={assignCoach.isPending}
                onChange={(e) => setCoachUserId(e.target.value)}
              >
                <option value="">Chọn HLV</option>
                {coachCandidates.data.data.map((c) => (
                  <option value={c.id} key={c.id}>
                    {c.fullName} · {c.email}
                    {c.coachProfile?.specializations?.length
                      ? ` (${c.coachProfile.specializations.map((s) => s.sport.name).join(", ")})`
                      : ""}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button
            className="text-button"
            disabled={assignCoach.isPending}
            onClick={() => setShowCreateCoach(coachAssignment)}
          >
            + Tạo Huấn luyện viên mới
          </button>
          {assignCoach.error && <ErrorState error={assignCoach.error} />}
          <div className="modal-footer">
            <button
              className="button"
              disabled={assignCoach.isPending}
              onClick={() => setCoachAssignment(undefined)}
            >
              Quay lại
            </button>
            <button
              className="button primary"
              disabled={!coachUserId || assignCoach.isPending}
              onClick={() => assignCoach.mutate()}
            >
              {assignCoach.isPending ? "Đang phân công…" : "Phân công HLV"}
            </button>
          </div>
        </Modal>
      )}

      {/* Create Coach Modal */}
      {showCreateCoach && (
        <CreateCoachModal
          facilityId={showCreateCoach.id}
          facilityName={showCreateCoach.name}
          onClose={() => setShowCreateCoach(undefined)}
          onSuccess={() => {
            setShowCreateCoach(undefined);
            setCoachAssignment(undefined);
            void cache.invalidateQueries();
          }}
        />
      )}

      {/* Remove Coach Modal */}
      {removingCoach && (
        <Modal
          title="Gỡ HLV khỏi cơ sở"
          dismissible={!removeCoach.isPending}
          onClose={() => setRemovingCoach(undefined)}
        >
          <p>
            Gỡ <strong>{removingCoach.coach.user.fullName}</strong> khỏi{" "}
            <strong>{removingCoach.facility.name}</strong>? Tài khoản HLV vẫn
            được giữ trong hệ thống và có thể phân công lại sau.
          </p>
          {removeCoach.error && <ErrorState error={removeCoach.error} />}
          <div className="modal-footer">
            <button
              className="button"
              disabled={removeCoach.isPending}
              onClick={() => setRemovingCoach(undefined)}
            >
              Quay lại
            </button>
            <button
              className="button danger"
              disabled={removeCoach.isPending}
              onClick={() => removeCoach.mutate()}
            >
              {removeCoach.isPending ? "Đang gỡ…" : "Gỡ HLV"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ─── Create Coach Modal ─────────────────────────────────────────── */
function CreateCoachModal({
  facilityId,
  facilityName,
  onClose,
  onSuccess,
}: {
  facilityId: string;
  facilityName: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
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
      allPages<{ id: string; name: string; isActive?: boolean }>(
        "GET /sports",
        { signal },
      ),
  });

  const activeSports = (sportsQuery.data?.data ?? []).filter(
    (s) => s.isActive !== false,
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
          experienceYears: experienceYears
            ? Number(experienceYears)
            : undefined,
          bio: bio.trim() || undefined,
          sportIds: selectedSports,
        },
      });
    },
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: ["admin-facilities"] });
      await cache.invalidateQueries({ queryKey: ["coach-candidates"] });
      onSuccess();
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
    <Modal
      title={`Tạo HLV mới · ${facilityName}`}
      onClose={onClose}
      dismissible={!createCoach.isPending}
    >
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
          Tạo tài khoản HLV mới và phân công ngay vào cơ sở{" "}
          <strong>{facilityName}</strong>. Bắt buộc chọn ít nhất 1 bộ môn giảng
          dạy.
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
              onChange={(e) => setGender(e.target.value as "MALE" | "FEMALE" | "OTHER")}
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

        <fieldset
          style={{ marginTop: "16px" }}
          disabled={createCoach.isPending}
        >
          <legend>Bộ môn giảng dạy * (Bắt buộc chọn ít nhất 1 môn)</legend>
          {sportsQuery.isPending ? (
            <Loading />
          ) : !activeSports.length ? (
            <Empty text="Không có bộ môn khả dụng" />
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fill, minmax(180px, 1fr))",
                gap: "8px",
                marginTop: "8px",
              }}
            >
              {activeSports.map((s) => (
                <label
                  key={s.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedSports.includes(s.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedSports([...selectedSports, s.id]);
                      } else {
                        setSelectedSports(
                          selectedSports.filter((id) => id !== s.id),
                        );
                      }
                    }}
                  />
                  {s.name}
                </label>
              ))}
            </div>
          )}
          {!selectedSports.length && (
            <p
              className="field-note"
              style={{
                color: "var(--color-danger, #ef4444)",
                marginTop: "4px",
              }}
            >
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
