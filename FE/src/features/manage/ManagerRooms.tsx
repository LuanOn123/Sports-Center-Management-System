import {
  EquipmentFields,
  equipmentValues,
} from "../../shared/forms/EquipmentFields";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type RecordData } from "../../shared/api";
import { allPages } from "../../shared/pagedApi";
import { getFacilityId } from "../../shared/facility";
import { Empty, ErrorState, Loading, Modal } from "../../shared/ui";
import { ResourcePage, ScheduleDetailView } from "./ResourcePage";
import { resources } from "./config";
import {
  ScheduleCalendar,
  calendarRange,
  type ScheduleCalendarView,
} from "./ScheduleCalendar";

type Room = {
  id: string;
  name: string;
  areaType?: string;
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
          <ScheduleDetailView data={selected} />
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
  const [values, setValues] = useState(
    equipmentValues(room.capabilities, "quantity"),
  );
  const cache = useQueryClient();
  const mutation = useMutation({
    mutationFn: () =>
      api("PUT /rooms/{id}/capabilities", {
        params: { id: room.id },
        body: {
          values: room.areaType === "INDOOR" ? values : {},
        },
      }),
    onMutate: () => onBusy(true),
    onSettled: () => onBusy(false),
    onSuccess: async () => {
      await cache.invalidateQueries();
      onClose();
    },
  });
  return (
    <form
      className="manager-config-form"
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
    >
      <fieldset disabled={mutation.isPending}>
        {room.areaType === "INDOOR" ? (
          <EquipmentFields value={values} onChange={setValues} />
        ) : (
          <p>Chỉ phòng trong nhà áp dụng lựa chọn có hoặc không có dụng cụ.</p>
        )}
        {mutation.error && <ErrorState error={mutation.error} />}
        <div className="modal-footer">
          <button type="button" className="button" onClick={onClose}>
            Hủy
          </button>
          <button className="button primary" disabled={mutation.isPending}>
            Lưu cấu hình
          </button>
        </div>
      </fieldset>
    </form>
  );
}
