import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import { allPages } from "./pagedApi";
import { display } from "./config";
import { getFacilityId } from "./facility";
import { Empty, ErrorState, Loading } from "./ui";

type Visit = {
  id: string;
  checkInAt: string;
  method: string;
  facility?: { name: string };
  member?: { user?: { fullName: string } };
};
type Member = { id: string; user?: { fullName: string; email: string } };

export function FacilityVisits({ staff = false }: { staff?: boolean }) {
  const [memberId, setMemberId] = useState("");
  const cache = useQueryClient();
  const members = useQuery({
    queryKey: ["check-in-members"],
    queryFn: ({ signal }) => allPages<Member>("GET /members", { signal }),
    enabled: staff,
  });
  const visits = useQuery({
    queryKey: ["facility-visits", staff, getFacilityId()],
    queryFn: ({ signal }) =>
      allPages<Visit>(
        staff ? "GET /facility-visits" : "GET /facility-visits/my",
        { signal },
      ),
  });
  const checkIn = useMutation({
    mutationFn: () =>
      api<Visit>(
        staff
          ? "POST /facility-visits/reception-check-in"
          : "POST /facility-visits/check-in",
        { body: staff ? { memberId, method: "RECEPTION" } : { method: "QR" } },
      ),
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: ["facility-visits"] });
    },
  });
  return (
    <div className="workflow-page">
      <h1>Check-in cơ sở</h1>
      <section className="panel">
        <p>
          Ghi nhận vào cửa tại cơ sở đang chọn. Cần gói còn hiệu lực; gói FREE
          cũng được vào cửa. Check-in lặp trong 5 phút sẽ trả lại lượt vừa ghi
          nhận.
        </p>
        {staff && (
          <label>
            Hội viên
            <select
              value={memberId}
              disabled={checkIn.isPending}
              onChange={(event) => {
                setMemberId(event.target.value);
                checkIn.reset();
              }}
            >
              <option value="">Chọn hội viên</option>
              {members.data?.data.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.user?.fullName} · {member.user?.email}
                </option>
              ))}
            </select>
          </label>
        )}
        {members.error && (
          <ErrorState error={members.error} retry={() => members.refetch()} />
        )}
        <button
          className="button primary"
          disabled={
            !getFacilityId() || checkIn.isPending || (staff && !memberId)
          }
          onClick={() => checkIn.mutate()}
        >
          {checkIn.isPending ? "Đang ghi nhận…" : "Check-in vào cơ sở"}
        </button>
        {checkIn.error && <ErrorState error={checkIn.error} />}
        {checkIn.isSuccess && (
          <p role="status" className="success">
            Đã ghi nhận lượt vào cửa lúc {display(checkIn.data.data.checkInAt)}.
          </p>
        )}
      </section>
      <section className="panel">
        <h2>
          {staff
            ? "Lượt vào cửa tại cơ sở đang chọn"
            : "Lịch sử vào cửa trên mọi cơ sở"}
        </h2>
        {visits.isPending ? (
          <Loading />
        ) : visits.isError ? (
          <ErrorState error={visits.error} retry={() => visits.refetch()} />
        ) : !visits.data.data.length ? (
          <Empty text="Chưa có lượt vào cửa." />
        ) : (
          <div className="detail-list">
            {visits.data.data.map((visit) => (
              <article className="workflow-card" key={visit.id}>
                <strong>
                  {visit.member?.user?.fullName ?? visit.facility?.name}
                </strong>
                <p>
                  {visit.facility?.name} · {display(visit.checkInAt)} ·{" "}
                  {visit.method === "RECEPTION" ? "Tại quầy" : "Tự check-in"}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
