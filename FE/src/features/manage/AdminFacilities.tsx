import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  Plus,
  UserRound,
  MapPin,
  Pencil,
  UserPlus,
  UserMinus,
} from "lucide-react";
import { api } from "../../shared/api";
import { toast } from "../../shared/toast";
import { Empty, ErrorState, Loading, Modal, SchemaForm } from "../../shared/ui";
import "./admin.css";
import { FacilityEditor } from "./FacilityEditor";

type StaffUser = {
  id: string;
  fullName: string;
  email: string;
  role?: string;
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
};

export function AdminFacilities() {
  const cache = useQueryClient();
  const [edit, setEdit] = useState<Facility | "create">();
  const [facilitySaving, setFacilitySaving] = useState(false);
  const [assignment, setAssignment] = useState<{
    facility: Facility;
    replaced?: Manager;
  }>();
  const [userId, setUserId] = useState("");
  const [createUser, setCreateUser] = useState(false);

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
      toast("success", "Quản lý đã được gỡ thành công.");
      setRemoving(undefined);
      void cache.invalidateQueries();
    },
  });

  const openAssignment = (facility: Facility, replaced?: Manager) => {
    save.reset();
    setUserId("");
    const targetReplaced = replaced ?? getManagers(facility)[0];
    setAssignment({ facility, replaced: targetReplaced });
  };

  const getManagers = (f: Facility) =>
    f.staffs?.filter((s) => s.role === "MANAGER") || [];
  return (
    <div className="workflow-page admin-workspace">
      <div className="page-heading">
        <div>
          <div className="eyebrow">MẠNG LƯỚI TRUNG TÂM</div>
          <h1>Quản lý cơ sở</h1>
          <p>Quản lý thông tin cơ sở và phân công người quản lý phụ trách.</p>
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
                          className="button small danger admin-manager-remove"
                          onClick={() => {
                            remove.reset();
                            setRemoving({ facility: f, manager: m });
                          }}
                        >
                          <UserMinus size={16} aria-hidden="true" />
                          Gỡ
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="admin-card-footer">
                <button className="button" onClick={() => setEdit(f)}>
                  <Pencil size={16} />
                  Chỉnh sửa
                </button>
                {getManagers(f).length > 0 ? (
                  <button
                    className="button"
                    disabled={!f.isActive}
                    onClick={() => openAssignment(f, getManagers(f)[0])}
                  >
                    <UserPlus size={16} />
                    Thay quản lý
                  </button>
                ) : (
                  <button
                    className="button"
                    disabled={!f.isActive}
                    onClick={() => openAssignment(f)}
                  >
                    <UserPlus size={16} />
                    Thêm quản lý
                  </button>
                )}
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
          dismissible={!facilitySaving}
          maxWidth={800}
        >
          <FacilityEditor
            initial={edit === "create" ? undefined : edit}
            onBusyChange={setFacilitySaving}
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
            className="button"
            disabled={save.isPending}
            onClick={() => setCreateUser(true)}
          >
            <UserPlus size={16} />
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
    </div>
  );
}
