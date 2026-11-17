import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type RecordData } from "../../../shared/api";
import { at, display } from "../../../shared/config";
import { ErrorState, Loading, Modal } from "../../../shared/ui";
import { useDebouncedValue } from "../../../shared/useDebouncedValue";
import type {
  CoursePlan,
  WholeCourseEnrollmentResult,
} from "../../../types/member";
import { useReceptionList } from "../api";
import { Heading, ListState, MemberPicker } from "../components";

type RegisteredMember = {
  memberId: string;
  fullName: string;
  email: string;
  bookedSessions: number;
  completedSessions: number;
};

type Target =
  | { kind: "book"; memberId: string; fullName: string }
  | {
      kind: "cancel";
      memberId: string;
      fullName: string;
      termId: string | null;
    };

const date = new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });

export function ClassesPage() {
  const [member, setMember] = useState<RecordData | null>(null);
  const [selected, setSelected] = useState<RecordData | null>(null);
  const [search, setSearch] = useState("");
  const searchQuery = useDebouncedValue(search.trim());
  const classes = useReceptionList(
    "GET /classes",
    searchQuery ? { search: searchQuery } : {},
  );

  return (
    <>
      <Heading title="Đăng ký khóa học" />
      <ol className="booking-steps" aria-label="Các bước đăng ký">
        <li className={member ? "done" : "current"}>
          <span>1</span>Chọn hội viên
        </li>
        <li className={selected ? "done" : member ? "current" : ""}>
          <span>2</span>Chọn khóa học
        </li>
        <li className={member && selected ? "current" : ""}>
          <span>3</span>Xác nhận đăng ký
        </li>
      </ol>
      <MemberPicker value={member} onChange={setMember} />
      <section className="panel reception-section">
        <h2>Khóa học tại cơ sở</h2>
        <div className="collection-toolbar">
          <label>
            Tìm khóa học
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
        </div>
        <ListState result={classes}>
          {(rows) =>
            rows.length ? (
              <div
                className="table-scroll"
                tabIndex={0}
                role="region"
                aria-label="Danh sách khóa học"
              >
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Khóa học</th>
                      <th scope="col">Hạng lớp</th>
                      <th scope="col">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={String(row.id)}>
                        <td>
                          <strong>{display(row.name)}</strong>
                        </td>
                        <td>{display(row.classType)}</td>
                        <td>
                          <button
                            className="button small"
                            aria-pressed={selected?.id === row.id}
                            onClick={() => setSelected(row)}
                          >
                            {selected?.id === row.id
                              ? "Đang chọn"
                              : "Xem đăng ký"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>Không tìm thấy khóa học phù hợp.</p>
            )
          }
        </ListState>
      </section>
      {selected && (
        <CourseDetails
          key={String(selected.id)}
          courseClass={selected}
          member={member}
        />
      )}
    </>
  );
}

function CourseDetails({
  courseClass,
  member,
}: {
  courseClass: RecordData;
  member: RecordData | null;
}) {
  const classId = String(courseClass.id);
  const cache = useQueryClient();
  const [target, setTarget] = useState<Target | null>(null);
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const planKey = ["reception", "course-plan", classId];
  const rosterKey = ["reception", "course-registrations", classId];
  const plan = useQuery({
    queryKey: planKey,
    queryFn: ({ signal }) =>
      api<CoursePlan>("GET /classes/{id}/course-plan", {
        params: { id: classId },
        signal,
      }),
  });
  const roster = useQuery({
    queryKey: rosterKey,
    queryFn: ({ signal }) =>
      api<{ members: RegisteredMember[] }>("GET /classes/{id}/registrations", {
        params: { id: classId },
        signal,
      }),
  });
  const change = useMutation({
    mutationFn: async (action: Target) => {
      if (action.kind === "book") {
        const result = await api<WholeCourseEnrollmentResult>(
          "POST /enrollments/bulk",
          {
            body: { classId, memberId: action.memberId },
          },
        );
        const { enrolledNow, totalRegistered } = result.data.summary;
        return enrolledNow > 0
          ? `Đã đăng ký trọn khóa cho ${action.fullName} (${totalRegistered} buổi).`
          : `${action.fullName} đã có đủ ${totalRegistered} buổi của khóa.`;
      }
      const result = await api<{
        cancelledSessions: number;
        cancelledWaitlist: number;
      }>("POST /enrollments/courses/{classId}/cancel", {
        params: { classId },
        body: { memberId: action.memberId, termId: action.termId },
      });
      const { cancelledSessions, cancelledWaitlist } = result.data;
      return cancelledSessions || cancelledWaitlist
        ? `Đã hủy ${cancelledSessions} buổi học và ${cancelledWaitlist} lượt chờ của ${action.fullName}.`
        : `${action.fullName} không có đăng ký hoặc lượt chờ cần hủy trong khóa này.`;
    },
    onSuccess: async (message) => {
      await Promise.all([
        cache.invalidateQueries({ queryKey: planKey }),
        cache.invalidateQueries({ queryKey: rosterKey }),
      ]);
      setNotice(message);
      setTarget(null);
    },
  });
  const course = plan.data?.data.course;
  const term = plan.data?.data.sessions[0]?.term;
  const termId = plan.data?.data.sessions[0]?.termId ?? null;
  const registered = roster.data?.data.members ?? [];
  const searchText = search.trim().toLocaleLowerCase("vi");
  const visible = registered.filter((row) =>
    `${row.fullName} ${row.email}`.toLocaleLowerCase("vi").includes(searchText),
  );
  const open = (next: Target) => {
    change.reset();
    setNotice("");
    setTarget(next);
  };

  return (
    <section className="panel reception-section">
      <h2>{display(courseClass.name)}</h2>
      {notice && (
        <p className="operation-feedback" role="status">
          {notice}
        </p>
      )}
      {plan.isPending ? (
        <Loading />
      ) : plan.isError ? (
        <ErrorState error={plan.error} retry={() => plan.refetch()} />
      ) : course ? (
        <>
          <p>
            {term && <>{term.name} · </>}
            {course.totalSessions} buổi sắp tới ·{" "}
            {date.format(new Date(course.firstSessionStart))} –{" "}
            {date.format(new Date(course.lastSessionEnd))}
          </p>
          <ul>
            {course.slots.map((slot) => (
              <li key={slot.sessionIds[0]}>
                {slot.weekdayLabel} · {slot.startTime}–{slot.endTime} ·{" "}
                {slot.roomName} · {slot.sessionCount} buổi
              </li>
            ))}
          </ul>
          {member ? (
            <button
              className="button primary"
              onClick={() =>
                open({
                  kind: "book",
                  memberId: String(member.id),
                  fullName: display(at(member, "user.fullName")),
                })
              }
            >
              Đăng ký trọn khóa cho {display(at(member, "user.fullName"))}
            </button>
          ) : (
            <p>Chọn hội viên để đăng ký trọn khóa.</p>
          )}
        </>
      ) : (
        <p>Khóa học chưa có buổi sắp tới để đăng ký.</p>
      )}
      <h3>Hội viên đã đăng ký</h3>
      {roster.isPending ? (
        <Loading />
      ) : roster.isError ? (
        <ErrorState error={roster.error} retry={() => roster.refetch()} />
      ) : !registered.length ? (
        <p>Chưa có hội viên đăng ký khóa học này.</p>
      ) : (
        <>
          <label>
            Tìm hội viên trong khóa
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          {visible.length ? (
            <div
              className="table-scroll"
              tabIndex={0}
              role="region"
              aria-label="Hội viên đã đăng ký khóa học"
            >
              <table>
                <thead>
                  <tr>
                    <th scope="col">Hội viên</th>
                    <th scope="col">Email</th>
                    <th scope="col">Buổi đã đặt</th>
                    <th scope="col">Buổi hoàn tất</th>
                    <th scope="col">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((row) => (
                    <tr key={row.memberId}>
                      <td>{row.fullName}</td>
                      <td>{row.email}</td>
                      <td>{row.bookedSessions}</td>
                      <td>{row.completedSessions}</td>
                      <td>
                        {course && row.bookedSessions > 0 && (
                          <button
                            className="button small danger"
                            onClick={() =>
                              open({
                                kind: "cancel",
                                memberId: row.memberId,
                                fullName: row.fullName,
                                termId,
                              })
                            }
                          >
                            Hủy toàn khóa
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>Không tìm thấy hội viên phù hợp.</p>
          )}
        </>
      )}
      {target && (
        <Modal
          title={
            target.kind === "book"
              ? "Xác nhận đăng ký trọn khóa"
              : "Hủy toàn khóa"
          }
          dismissible={!change.isPending}
          onClose={() => setTarget(null)}
        >
          <div className="confirmation-body">
            {target.kind === "book" ? (
              <p>
                Đăng ký toàn bộ {course?.totalSessions} buổi sắp tới của{" "}
                <strong>{display(courseClass.name)}</strong> cho{" "}
                <strong>{target.fullName}</strong>.
              </p>
            ) : (
              <p>
                Hủy các buổi chưa bắt đầu và lượt chờ của{" "}
                <strong>{target.fullName}</strong> trong khóa{" "}
                <strong>{display(courseClass.name)}</strong>
                {term ? ` thuộc kỳ ${term.name}` : ""}?
              </p>
            )}
            {change.error && <ErrorState error={change.error} />}
            <div className="confirmation-actions">
              <button
                className="button"
                disabled={change.isPending}
                onClick={() => setTarget(null)}
              >
                Quay lại
              </button>
              <button
                className={
                  target.kind === "book" ? "button primary" : "button danger"
                }
                disabled={change.isPending}
                onClick={() => change.mutate(target)}
              >
                {change.isPending
                  ? "Đang xử lý…"
                  : target.kind === "book"
                    ? "Xác nhận đăng ký"
                    : "Xác nhận hủy toàn khóa"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}
