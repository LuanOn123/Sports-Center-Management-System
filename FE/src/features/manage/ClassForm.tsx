import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, Search, X, MapPin, Users } from "lucide-react";
import { api, type RecordData } from "../../shared/api";
import { allPages } from "../../shared/pagedApi";
import { classSports } from "../../shared/sports";
import { assertCoachCanTeach } from "../../shared/coachEligibility";
import { display, at } from "../../shared/config";
import { ErrorState, Loading } from "../../shared/ui";
import "./admin.css";

type Sport = {
  id: string;
  name: string;
  areaTypes: string[];
  isActive: boolean;
};
type Room = {
  id: string;
  name: string;
  capacity: number;
  areaType: string;
  isActive: boolean;
};
export function ClassForm({
  initial = {},
  onSuccess,
  onCancel,
  onBusyChange,
}: {
  initial?: RecordData;
  onSuccess: () => void;
  onCancel: () => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [name, setName] = useState(String(initial.name ?? ""));
  const [description, setDescription] = useState(
    String(initial.description ?? ""),
  );
  const [sportIds, setSportIds] = useState<string[]>(
    classSports(initial).map((s) => s.id),
  );
  const [search, setSearch] = useState("");
  const [roomId, setRoomId] = useState(String(initial.defaultRoomId ?? ""));
  const [capacity, setCapacity] = useState(String(initial.capacity ?? ""));
  const [classType, setClassType] = useState(
    String(initial.classType ?? "REGULAR"),
  );
  const [policy, setPolicy] = useState(
    String(initial.attendancePolicy ?? "RECURRING"),
  );
  const [planned, setPlanned] = useState(
    String(initial.plannedSessionCount ?? ""),
  );
  const [error, setError] = useState<unknown>();
  const locked = Number(at(initial, "_count.enrollments") ?? 0) > 0;
  const sports = useQuery({
    queryKey: ["class-form", "sports"],
    queryFn: ({ signal }) => allPages<Sport>("GET /sports", { signal }),
  });
  const rooms = useQuery({
    queryKey: ["class-form", "rooms"],
    queryFn: ({ signal }) => allPages<Room>("GET /rooms", { signal }),
  });
  const allSports = sports.data?.data ?? [];
  const selected = allSports.filter((s) => sportIds.includes(s.id));
  const allowedAreas = selected.length
    ? ["INDOOR", "OUTDOOR", "POOL"].filter((area) =>
        selected.every((s) => s.areaTypes.includes(area)),
      )
    : [];
  const eligibleRooms =
    rooms.data?.data.filter(
      (r) => r.isActive && allowedAreas.includes(r.areaType),
    ) ?? [];
  const room = eligibleRooms.find((r) => r.id === roomId);
  const save = useMutation({
    mutationFn: async (body: RecordData) => {
      const previous = classSports(initial).map((sport) => sport.id);
      if (
        initial.id &&
        (previous.length !== sportIds.length ||
          sportIds.some((id) => !previous.includes(id)))
      ) {
        const current = await api<RecordData>("GET /classes/{id}", {
          params: { id: String(initial.id) },
        });
        const assignments = Array.isArray(current.data.coaches)
          ? current.data.coaches
          : [];
        for (const assignment of assignments) {
          const coachId = String(
            at(assignment, "coach.id") || at(assignment, "coachId") || "",
          );
          if (!coachId)
            throw new Error(
              "Không xác định được HLV đang phụ trách lớp. Hãy kiểm tra phân công trước khi đổi bộ môn.",
            );
          await assertCoachCanTeach(coachId, sportIds);
        }
      }
      return api(initial.id ? "PATCH /classes/{id}" : "POST /classes", {
        params: initial.id ? { id: String(initial.id) } : {},
        body,
      });
    },
    onSuccess,
    onSettled: () => onBusyChange?.(false),
  });
  function toggle(id: string) {
    const next = sportIds.includes(id)
      ? sportIds.filter((value) => value !== id)
      : [...sportIds, id];
    setSportIds(next);
    const nextSports = allSports.filter((s) => next.includes(s.id));
    if (
      !nextSports.length ||
      !room ||
      !nextSports.every((s) => s.areaTypes.includes(room.areaType))
    )
      setRoomId("");
  }
  return (
    <form
      className="class-form"
      onSubmit={(event) => {
        event.preventDefault();
        setError(undefined);
        if (!room || !selected.length || selected.some((s) => !s.isActive)) {
          setError(new Error("Chọn bộ môn đang hoạt động và phòng phù hợp."));
          return;
        }
        const limit = Math.min(200, room.capacity),
          count = Number(capacity);
        if (!Number.isInteger(count) || count < 1 || count > limit) {
          setError(new Error(`Sĩ số phải từ 1 đến ${limit} học viên.`));
          return;
        }
        if (
          !locked &&
          policy === "FIXED" &&
          (!Number.isInteger(Number(planned)) ||
            Number(planned) < 1 ||
            Number(planned) > 1000)
        ) {
          setError(new Error("Khóa cố định cần tổng số buổi từ 1 đến 1000."));
          return;
        }
        const body: RecordData = {
          name: name.trim(),
          description: description.trim(),
          sportIds,
          defaultRoomId: room.id,
          areaType: room.areaType,
          capacity: count,
          classType,
        };
        if (
          !locked &&
          (!initial.id ||
            policy !== initial.attendancePolicy ||
            (policy === "FIXED" &&
              Number(planned) !== initial.plannedSessionCount))
        ) {
          body.attendancePolicy = policy;
          if (policy === "FIXED") body.plannedSessionCount = Number(planned);
        }
        onBusyChange?.(true);
        save.mutate(body);
      }}
    >
      <fieldset className="form-grid" disabled={save.isPending}>
        <label className="wide">
          Tên lớp học
          <input
            required
            minLength={2}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="wide">
          Mô tả
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <div className="wide class-sport-field">
          <span className="field-title">
            Các bộ môn <b className="required">*</b>
          </span>
          {sports.isPending ? (
            <Loading />
          ) : (
            <>
              <div className="sport-chips">
                {selected.map((s) => (
                  <button
                    type="button"
                    key={s.id}
                    className="sport-chip"
                    onClick={() => toggle(s.id)}
                  >
                    {s.name}
                    <X size={14} />
                  </button>
                ))}
              </div>
              <details className="sport-picker">
                <summary>
                  {selected.length
                    ? `Đã chọn ${selected.length} bộ môn · thay đổi`
                    : "Chọn bộ môn cho lớp"}
                </summary>
                <div className="sport-picker-popover">
                  <div className="sport-search">
                    <Search size={16} />
                    <input
                      aria-label="Tìm bộ môn"
                      placeholder="Tìm bộ môn…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  <div className="sport-options">
                    {allSports
                      .filter(
                        (s) =>
                          (s.isActive || sportIds.includes(s.id)) &&
                          s.name
                            .toLocaleLowerCase("vi")
                            .includes(search.toLocaleLowerCase("vi")),
                      )
                      .map((s) => (
                        <label className="sport-option" key={s.id}>
                          <input
                            type="checkbox"
                            checked={sportIds.includes(s.id)}
                            onChange={() => toggle(s.id)}
                          />
                          <span>
                            <strong>{s.name}</strong>
                            <small>
                              {s.areaTypes.map(display).join(" · ")}
                              {!s.isActive && " · Ngừng hoạt động"}
                            </small>
                          </span>
                          {sportIds.includes(s.id) && <Check size={16} />}
                        </label>
                      ))}
                  </div>
                </div>
              </details>
            </>
          )}
          {sports.error && (
            <ErrorState error={sports.error} retry={() => sports.refetch()} />
          )}
          {selected.length > 0 && !allowedAreas.length && (
            <p className="field-note danger-text">
              Các bộ môn này không có loại khu vực chung. Hãy chọn lại bộ môn.
            </p>
          )}
        </div>
        <label className="wide">
          Phòng tập <b className="required">*</b>
          <select
            required
            aria-label="Phòng tập cho lớp"
            disabled={!allowedAreas.length || rooms.isPending || rooms.isError}
            value={roomId}
            onChange={(e) => {
              setRoomId(e.target.value);
              const next = eligibleRooms.find((r) => r.id === e.target.value);
              if (next)
                setCapacity(
                  String(
                    capacity
                      ? Math.min(Number(capacity), next.capacity, 200)
                      : Math.min(next.capacity, 200),
                  ),
                );
            }}
          >
            <option value="">
              {selected.length ? "Chọn phòng phù hợp" : "Chọn bộ môn trước"}
            </option>
            {eligibleRooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} · {r.capacity} chỗ · {display(r.areaType)}
              </option>
            ))}
          </select>
        </label>
        {rooms.error && (
          <ErrorState error={rooms.error} retry={() => rooms.refetch()} />
        )}
        {allowedAreas.length > 0 &&
          !rooms.isPending &&
          !rooms.isError &&
          !eligibleRooms.length && (
            <p className="field-note wide">
              Cơ sở chưa có phòng đang hoạt động cùng loại khu vực:{" "}
              {allowedAreas.map(display).join(", ")}.
            </p>
          )}
        {room && (
          <div className="class-room-summary wide">
            <MapPin size={18} />
            <strong>{room.name}</strong>
            <span>{display(room.areaType)}</span>
            <span>
              <Users size={16} />
              {room.capacity} chỗ
            </span>
          </div>
        )}
        <label>
          Sĩ số lớp
          <input
            type="number"
            required
            min={1}
            max={Math.min(200, room?.capacity ?? 200)}
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
          />
        </label>
        <label>
          Loại lớp
          <select
            value={classType}
            onChange={(e) => setClassType(e.target.value)}
          >
            <option value="REGULAR">Tiêu chuẩn</option>
            <option value="PREMIUM">Cao cấp</option>
          </select>
        </label>
        <label>
          Chính sách chuyên cần
          <select
            disabled={locked}
            value={policy}
            onChange={(e) => setPolicy(e.target.value)}
          >
            <option value="RECURRING">Lớp định kỳ</option>
            <option value="FIXED">Khóa cố định</option>
          </select>
        </label>
        {policy === "FIXED" && (
          <label>
            Tổng số buổi kế hoạch
            <input
              type="number"
              required
              min={1}
              max={1000}
              disabled={locked}
              value={planned}
              onChange={(e) => setPlanned(e.target.value)}
            />
          </label>
        )}
        {locked && (
          <p className="field-note wide">
            Chính sách chuyên cần đã khóa vì lớp có lượt đăng ký.
          </p>
        )}
      </fieldset>
      {(error || save.error) && <ErrorState error={error || save.error} />}
      <div className="modal-footer">
        <button
          type="button"
          className="button"
          disabled={save.isPending}
          onClick={onCancel}
        >
          Hủy
        </button>
        <button
          className="button primary"
          disabled={save.isPending || sports.isPending || rooms.isPending}
        >
          {save.isPending ? "Đang lưu…" : "Lưu lớp học"}
        </button>
      </div>
    </form>
  );
}
