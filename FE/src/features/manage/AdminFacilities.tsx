import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  Plus,
  UserRound,
  MapPin,
  Pencil,
  UserPlus,
} from "lucide-react";
import { api } from "../../shared/api";
import { Empty, ErrorState, Loading, Modal, SchemaForm } from "../../shared/ui";
import "./admin.css";

type Manager = {
  userId: string;
  isActive: boolean;
  user: { fullName: string; email: string };
};
type Facility = {
  id: string;
  name: string;
  code: string;
  address: string;
  contactInfo?: string;
  isActive: boolean;
  staffs: Manager[];
};
type Candidate = { id: string; fullName: string; email: string; role: string };
export function AdminFacilities() {
  const cache = useQueryClient();
  const [edit, setEdit] = useState<Facility | "create">();
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
      setRemoving(undefined);
      void cache.invalidateQueries();
    },
  });
  const openAssignment = (facility: Facility, replaced?: Manager) => {
    save.reset();
    setUserId("");
    setAssignment({ facility, replaced });
  };
  return (
    <div className="workflow-page admin-workspace">
      <div className="page-heading">
        <div>
          <div className="eyebrow">MẠNG LƯỚI TRUNG TÂM</div>
          <h1>Quản lý cơ sở</h1>
          <p>
            Thông tin cơ sở và đội ngũ quản lý phụ trách trong cùng một nơi.
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
              <div className="admin-manager-list">
                <h3>
                  <UserRound size={17} />
                  Quản lý phụ trách
                </h3>
                {!f.staffs?.length ? (
                  <p className="field-note">Chưa phân công quản lý.</p>
                ) : (
                  f.staffs.map((m) => (
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
              </div>
            </article>
          ))}
        </div>
      )}
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
