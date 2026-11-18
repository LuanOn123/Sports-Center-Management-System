import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import { allPages } from "./pagedApi";
import { display } from "./config";
import { getFacilityId } from "./facility";
import { Empty, ErrorState, Loading } from "./ui";
import { Clock3, DoorOpen, MapPin, ScanLine } from "lucide-react";
import { QrCameraScanner } from "./QrCameraScanner";
import "./operation-surfaces.css";

type Visit = {
  id: string;
  checkInAt: string;
  method: string;
  facility?: { name: string };
  member?: { user?: { fullName: string } };
};
type Member = {
  id: string;
  userId?: string;
  user?: { id?: string; fullName: string; email: string };
};

/** Mã QR thẻ hội viên (app mobile) chứa userId; lễ tân cũng có thể nhập id hồ sơ — BE nhận cả hai. */
export function memberCodeFromScan(text: string) {
  return text.trim();
}

function findMember(members: Member[] | undefined, code: string) {
  return members?.find(
    (member) =>
      member.id === code || member.userId === code || member.user?.id === code,
  );
}

export function FacilityVisits({ staff = false }: { staff?: boolean }) {
  const [memberId, setMemberId] = useState("");
  const [code, setCode] = useState("");
  const [camera, setCamera] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const codeInput = useRef<HTMLInputElement>(null);
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
    mutationFn: async (target: string | null) => {
      const result = await api<Visit>(
        staff
          ? "POST /facility-visits/reception-check-in"
          : "POST /facility-visits/check-in",
        {
          body: staff
            ? { memberId: target, method: "RECEPTION" }
            : { method: "QR" },
        },
      );
      return {
        visit: result.data,
        // BE trả 200 "Already checked in recently" khi đã có lượt trong 5 phút (không tạo lượt mới)
        duplicate: /already checked in/i.test(String(result.message ?? "")),
        memberName: target
          ? findMember(members.data?.data, target)?.user?.fullName
          : undefined,
      };
    },
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: ["facility-visits"] });
      setCode("");
    },
    onSettled: () => {
      // Sẵn sàng cho lượt quét tiếp theo (máy quét cầm tay gõ vào ô đang được chọn)
      if (staff) setTimeout(() => codeInput.current?.focus(), 0);
    },
  });
  const submitCode = (raw: string) => {
    const value = memberCodeFromScan(raw);
    if (!value || checkIn.isPending) return;
    setCamera(false);
    checkIn.mutate(value);
  };
  return (
    <div className="workflow-page">
      <div className="page-heading">
        <div>
          <h1>Check-in cơ sở</h1>
        </div>
      </div>
      <section className="panel operation-visit-form">
        <div className="operation-heading-title">
          <span className="operation-icon">
            <DoorOpen size={18} aria-hidden="true" />
          </span>
          <strong>Ghi nhận lượt vào cửa</strong>
        </div>
        <p>
          {staff &&
            "Quét mã QR trên màn Check-in của app hội viên (máy quét cầm tay hoặc camera). "}
          Ghi nhận vào cửa tại cơ sở đang chọn. Cần gói còn hiệu lực; gói FREE
          cũng được vào cửa. Check-in lặp trong 5 phút sẽ trả lại lượt vừa ghi
          nhận.
        </p>
        {staff && (
          <>
            <form
              className="operation-scan-form"
              onSubmit={(event) => {
                event.preventDefault();
                submitCode(code);
              }}
            >
              <label>
                Quét hoặc nhập mã hội viên
                <input
                  ref={codeInput}
                  autoFocus
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="Quét QR trên app hội viên hoặc nhập mã"
                  value={code}
                  disabled={checkIn.isPending}
                  onChange={(event) => {
                    setCode(event.target.value);
                    checkIn.reset();
                  }}
                />
              </label>
              <div className="operation-scan-actions">
                <button
                  type="submit"
                  className="button primary"
                  disabled={!getFacilityId() || checkIn.isPending || !code.trim()}
                >
                  Check-in theo mã
                </button>
                <button
                  type="button"
                  className="button"
                  disabled={!getFacilityId() || checkIn.isPending}
                  onClick={() => {
                    checkIn.reset();
                    setCameraError("");
                    setCamera(!camera);
                  }}
                >
                  <ScanLine size={16} aria-hidden="true" />
                  {camera ? "Dừng camera" : "Quét bằng camera"}
                </button>
              </div>
            </form>
            {camera && (
              <QrCameraScanner
                label="Camera quét mã hội viên"
                onResult={submitCode}
                onError={(message) => {
                  setCameraError(message);
                  setCamera(false);
                }}
              />
            )}
            {cameraError && <p role="alert">{cameraError}</p>}
          </>
        )}
        {staff && (
          <label>
            Hoặc chọn hội viên
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
          className={staff ? "button" : "button primary"}
          disabled={
            !getFacilityId() || checkIn.isPending || (staff && !memberId)
          }
          onClick={() => checkIn.mutate(staff ? memberId : null)}
        >
          {checkIn.isPending ? "Đang ghi nhận…" : "Check-in vào cơ sở"}
        </button>
        {checkIn.error && <ErrorState error={checkIn.error} />}
        {checkIn.isSuccess && (
          <p role="status" className="operation-feedback">
            {checkIn.data.duplicate
              ? `${checkIn.data.memberName ?? "Hội viên"} đã check-in lúc ${display(checkIn.data.visit.checkInAt)} (trong 5 phút gần đây), không ghi thêm lượt mới.`
              : `Đã ghi nhận lượt vào cửa${checkIn.data.memberName ? ` cho ${checkIn.data.memberName}` : ""} lúc ${display(checkIn.data.visit.checkInAt)}.`}
          </p>
        )}
      </section>
      <section className="panel">
        <div className="operation-heading">
          <div className="operation-heading-title">
            <span className="operation-icon">
              <Clock3 size={18} aria-hidden="true" />
            </span>
            <h2>
              {staff
                ? "Lượt vào cửa tại cơ sở đang chọn"
                : "Lịch sử vào cửa trên mọi cơ sở"}
            </h2>
          </div>
        </div>
        {visits.isPending ? (
          <Loading />
        ) : visits.isError ? (
          <ErrorState error={visits.error} retry={() => visits.refetch()} />
        ) : !visits.data.data.length ? (
          <Empty text="Chưa có lượt vào cửa." />
        ) : (
          <div className="operation-list">
            {visits.data.data.map((visit) => (
              <article
                className="operation-card operation-visit-card"
                key={visit.id}
              >
                <span className="operation-icon">
                  <MapPin size={17} aria-hidden="true" />
                </span>
                <div>
                  <strong>
                    {visit.member?.user?.fullName ?? visit.facility?.name}
                  </strong>
                  <p>
                    {visit.member?.user?.fullName &&
                      visit.facility?.name &&
                      `${visit.facility.name} · `}
                    {display(visit.checkInAt)}
                  </p>
                </div>
                <span className="operation-tag">
                  {visit.method === "RECEPTION" ? "Tại quầy" : "Tự check-in"}
                </span>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
