import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { api } from "./api";
import { allPages } from "./pagedApi";
import { display } from "./config";
import { Empty, ErrorState, Loading } from "./ui";

export type WaitlistEntry = {
  id: string;
  scheduleId: string;
  position: number;
  status: "WAITING" | "PROMOTED" | "CANCELLED";
  schedule?: { startTime: string; class?: { name: string } };
  member?: { user?: { fullName: string } };
};

export function WaitlistAction({ scheduleId }: { scheduleId: string }) {
  const cache = useQueryClient();
  const join = useMutation({
    mutationFn: () =>
      api<WaitlistEntry>("POST /waitlist", { body: { scheduleId } }),
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: ["waitlist"] });
    },
  });
  return (
    <div>
      <button
        className="button small"
        disabled={join.isPending || join.isSuccess}
        onClick={() => join.mutate()}
      >
        {join.isPending
          ? "Đang đăng ký…"
          : join.isSuccess
            ? `Đã vào danh sách chờ · thứ tự ${join.data.data.position}`
            : "Vào danh sách chờ"}
      </button>
      {join.error && <ErrorState error={join.error} />}
    </div>
  );
}

export function Waitlist({ scheduleId }: { scheduleId?: string }) {
  const cache = useQueryClient();
  const history = useQuery({
    queryKey: ["waitlist", scheduleId ?? "my"],
    queryFn: ({ signal }) =>
      allPages<WaitlistEntry>(
        scheduleId ? "GET /waitlist/schedule/{scheduleId}" : "GET /waitlist/my",
        {
          ...(scheduleId ? { params: { scheduleId } } : {}),
          signal,
        },
      ),
    refetchInterval: 30_000,
  });
  const leave = useMutation({
    mutationFn: (id: string) =>
      api("DELETE /waitlist/{id}", { params: { id } }),
    onSettled: () => {
      void cache.invalidateQueries({ queryKey: ["waitlist"] });
    },
  });
  const promoted =
    history.data?.data
      .filter((entry) => entry.status === "PROMOTED")
      .map((entry) => entry.id)
      .sort()
      .join(",") ?? "";
  useEffect(() => {
    if (!promoted || scheduleId) return;
    for (const queryKey of [
      ["my-enrollments"],
      ["my-enrollment-quota"],
      ["member-schedule"],
      ["course-plan"],
    ])
      void cache.invalidateQueries({ queryKey });
  }, [promoted, scheduleId, cache]);
  const states = {
    WAITING: "Đang chờ",
    PROMOTED: "Đã được xếp chỗ",
    CANCELLED: "Đã rời danh sách",
  };
  return (
    <section className="panel">
      <h2>Danh sách chờ theo buổi</h2>
      <p>
        Khi có chỗ trống, hệ thống xét theo thứ tự chờ và kiểm tra lại gói tập,
        quota, lịch học và quyết định chuyên cần. Vào danh sách chờ chưa đảm bảo
        có chỗ.
      </p>
      {history.isPending ? (
        <Loading />
      ) : history.isError ? (
        <ErrorState error={history.error} retry={() => history.refetch()} />
      ) : !history.data.data.length ? (
        <Empty text="Chưa có lượt đăng ký chờ." />
      ) : (
        <div className="detail-list">
          {history.data.data.map((entry) => (
            <article className="workflow-card" key={entry.id}>
              <h3>
                {entry.member?.user?.fullName ??
                  entry.schedule?.class?.name ??
                  "Buổi học"}
              </h3>
              <p>
                {display(entry.schedule?.startTime)} · Thứ tự {entry.position} ·{" "}
                {states[entry.status]}
              </p>
              {!scheduleId && entry.status === "WAITING" && (
                <button
                  className="button small"
                  disabled={leave.isPending}
                  onClick={() => leave.mutate(entry.id)}
                >
                  Rời danh sách chờ
                </button>
              )}
            </article>
          ))}
        </div>
      )}
      {leave.error && <ErrorState error={leave.error} />}
    </section>
  );
}
