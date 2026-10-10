import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type RecordData } from "../../shared/api";
import { allPages } from "../../shared/pagedApi";
import { getFacilityId } from "../../shared/facility";
import { Details, Empty, ErrorState, Loading, Modal } from "../../shared/ui";
import { ResourcePage } from "./ResourcePage";
import { resources } from "./config";
import {
  ScheduleCalendar,
  calendarRange,
  type ScheduleCalendarView,
} from "./ScheduleCalendar";

type Room = {
  id: string;
  name: string;
  capabilities?: { key: string; quantity: number }[];
};
export function ManagerRooms({ userId }: { userId: string }) {
  const [tab, setTab] = useState("rooms");
  return (
    <>
      <div className="tabs">
        <button
          className={tab === "rooms" ? "active" : ""}
          aria-pressed={tab === "rooms"}
          onClick={() => setTab("rooms")}
        >
          Quản lý phòng
        </button>
        <button
          className={tab === "usage" ? "active" : ""}
          aria-pressed={tab === "usage"}
          onClick={() => setTab("usage")}
        >
          Sử dụng & cấu hình phòng
        </button>
      </div>
      {tab === "rooms" ? (
        <ResourcePage
          resource={resources.find((r) => r.slug === "rooms")!}
          userId={userId}
        />
      ) : (
        <RoomUsage />
      )}
    </>
  );
}
function RoomUsage() {
  const facilityId = getFacilityId();
  const [roomId, setRoomId] = useState("");
  const [cursor, setCursor] = useState(new Date());
  const [view, setView] = useState<ScheduleCalendarView>("week");
  const [selected, setSelected] = useState<RecordData>();
  const [configure, setConfigure] = useState(false);
  const range = calendarRange(cursor, view);
  const rooms = useQuery({
    queryKey: ["manager-rooms", facilityId],
    queryFn: ({ signal }) => allPages<Room>("GET /rooms", { signal }),
  });
  const schedules = useQuery({
    queryKey: [
      "manager-room-usage",
      facilityId,
      roomId,
      range.start.toISOString(),
      range.end.toISOString(),
    ],
    queryFn: ({ signal }) =>
      allPages<RecordData>("GET /class-schedules", {
        query: {
          roomId,
          from: range.start.toISOString(),
          to: range.end.toISOString(),
        },
        signal,
      }),
    enabled: Boolean(roomId),
  });
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Sử dụng phòng tập</h1>
          <p>
            Lịch phòng lấy trực tiếp từ lịch lớp học. Khoảng trống là thời gian
            chưa có buổi học trong dữ liệu hiện tại.
          </p>
        </div>
      </div>
      {rooms.isPending ? (
        <Loading />
      ) : rooms.error ? (
        <ErrorState error={rooms.error} retry={() => rooms.refetch()} />
      ) : (
        <div className="filters">
          <label>
            Phòng tập
            <select value={roomId} onChange={(e) => setRoomId(e.target.value)}>
              <option value="">Chọn phòng</option>
              {rooms.data?.data.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name}
                </option>
              ))}
            </select>
          </label>
          <button
            className="button"
            disabled={!roomId}
            onClick={() => setConfigure(true)}
          >
            Cấu hình phòng
          </button>
        </div>
      )}
      {!roomId ? (
        <Empty text="Chọn phòng để xem lịch sử dụng" />
      ) : schedules.isPending ? (
        <Loading />
      ) : schedules.error ? (
        <ErrorState error={schedules.error} retry={() => schedules.refetch()} />
      ) : (
        <section className="panel">
          <ScheduleCalendar
            rows={schedules.data?.data || []}
            cursor={cursor}
            view={view}
            onCursorChange={setCursor}
            onViewChange={setView}
            onSelect={setSelected}
          />
        </section>
      )}
      {selected && (
        <Modal
          title="Buổi học sử dụng phòng"
          onClose={() => setSelected(undefined)}
        >
          <Details value={selected} />
        </Modal>
      )}
      {configure && (
        <RoomCapabilities id={roomId} onClose={() => setConfigure(false)} />
      )}
    </>
  );
}
function RoomCapabilities({
  id,
  onClose,
}: {
  id: string;
  onClose: () => void;
}) {
  const q = useQuery({
    queryKey: ["manager-room-capabilities", getFacilityId(), id],
    queryFn: ({ signal }) =>
      api<Room>("GET /rooms/{id}", { params: { id }, signal }),
  });
  const [busy, setBusy] = useState(false);
  return (
    <Modal title="Cấu hình phòng" onClose={onClose} dismissible={!busy}>
      {q.isPending ? (
        <Loading />
      ) : q.error ? (
        <ErrorState error={q.error} retry={() => q.refetch()} />
      ) : (
        q.data && (
          <CapabilitiesForm
            room={q.data.data}
            onClose={onClose}
            onBusy={setBusy}
          />
        )
      )}
    </Modal>
  );
}
function CapabilitiesForm({
  room,
  onClose,
  onBusy,
}: {
  room: Room;
  onClose: () => void;
  onBusy: (value: boolean) => void;
}) {
  const [rows, setRows] = useState(
    (room.capabilities || []).map((r) => ({ ...r, id: crypto.randomUUID() })),
  );
  const cache = useQueryClient();
  const mutation = useMutation({
    mutationFn: () =>
      api("PUT /rooms/{id}/capabilities", {
        params: { id: room.id },
        body: {
          values: Object.fromEntries(
            rows.map((r) => [r.key.trim(), r.quantity]),
          ),
        },
      }),
    onMutate: () => onBusy(true),
    onSettled: () => onBusy(false),
    onSuccess: async () => {
      await cache.invalidateQueries();
      onClose();
    },
  });
  const duplicate = new Set(rows.map((r) => r.key.trim())).size !== rows.length;
  return (
    <form
      className="manager-config-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!duplicate) mutation.mutate();
      }}
    >
      <p>
        Nhập mã cấu hình tương ứng với yêu cầu của bộ môn. Thay đổi không phù
        hợp với lịch sắp tới sẽ bị từ chối.
      </p>
      <fieldset disabled={mutation.isPending}>
        {rows.map((row, index) => (
          <div className="filters" key={row.id}>
            <label>
              Mã cấu hình {index + 1}
              <input
                required
                maxLength={80}
                value={row.key}
                onChange={(e) =>
                  setRows(
                    rows.map((r) =>
                      r.id === row.id ? { ...r, key: e.target.value } : r,
                    ),
                  )
                }
              />
            </label>
            <label>
              Số lượng
              <input
                type="number"
                min={0}
                step={1}
                required
                value={row.quantity}
                onChange={(e) =>
                  setRows(
                    rows.map((r) =>
                      r.id === row.id
                        ? { ...r, quantity: Number(e.target.value) }
                        : r,
                    ),
                  )
                }
              />
            </label>
            <button
              type="button"
              className="button"
              onClick={() => setRows(rows.filter((r) => r.id !== row.id))}
            >
              Bỏ cấu hình {index + 1}
            </button>
          </div>
        ))}
        <button
          type="button"
          className="button"
          onClick={() =>
            setRows([
              ...rows,
              { id: crypto.randomUUID(), key: "", quantity: 0 },
            ])
          }
        >
          Thêm cấu hình
        </button>
        {duplicate && <p role="alert">Mã cấu hình không được trùng.</p>}
        {mutation.error && <ErrorState error={mutation.error} />}
        <div className="modal-footer">
          <button type="button" className="button" onClick={onClose}>
            Hủy
          </button>
          <button
            className="button primary"
            disabled={duplicate || mutation.isPending}
          >
            Lưu cấu hình
          </button>
        </div>
      </fieldset>
    </form>
  );
}
