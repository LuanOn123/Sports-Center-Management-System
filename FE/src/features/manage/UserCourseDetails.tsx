import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type RecordData } from "../../shared/api";
import {
  Details,
  Empty,
  ErrorState,
  Loading,
  Modal,
  SchemaForm,
} from "../../shared/ui";
import { at, display } from "../../shared/config";

export function MemberProfile({ id }: { id: string }) {
  const cache = useQueryClient(),
    [editing, setEditing] = useState(false);
  const profile = useQuery({
    queryKey: ["user-member-profile", id],
    queryFn: ({ signal }) =>
      api<RecordData>("GET /members/{id}", { params: { id }, signal }),
  });
  return (
    <section className="detail-section">
      <div className="panel-heading">
        <h3>Hồ sơ hội viên</h3>
        <button
          className="button small"
          disabled={!profile.data}
          onClick={() => setEditing(true)}
        >
          Chỉnh sửa hồ sơ hội viên
        </button>
      </div>
      {profile.isPending ? (
        <Loading />
      ) : profile.error ? (
        <ErrorState error={profile.error} retry={() => profile.refetch()} />
      ) : (
        <Details value={profile.data.data} />
      )}
      {editing && (
        <Modal title="Hồ sơ hội viên" onClose={() => setEditing(false)}>
          <SchemaForm
            operation="PATCH /members/{id}"
            params={{ id }}
            initial={{
              ...profile.data?.data,
              ...(profile.data?.data.user as RecordData),
            }}
            onCancel={() => setEditing(false)}
            onSuccess={() => {
              setEditing(false);
              void cache.invalidateQueries();
            }}
          />
        </Modal>
      )}
    </section>
  );
}

type Registrations = {
  totalMembers: number;
  totalEnrollments: number;
  sessions: RecordData[];
  members: {
    memberId: string;
    fullName: string;
    email: string;
    bookedSessions: number;
    completedSessions: number;
  }[];
};
export function ClassRegistrations({ id }: { id: string }) {
  const roster = useQuery({
    queryKey: ["class-registrations", id],
    queryFn: ({ signal }) =>
      api<Registrations>("GET /classes/{id}/registrations", {
        params: { id },
        signal,
      }),
  });
  const sessions = roster.data?.data.sessions ?? [];
  return (
    <div className="workflow-page">
      <section className="detail-section">
        <h3>Hội viên đăng ký khóa học</h3>
        {roster.isPending ? (
          <Loading />
        ) : roster.error ? (
          <ErrorState error={roster.error} retry={() => roster.refetch()} />
        ) : (
          <>
            <p>
              <strong>{roster.data.data.totalMembers} hội viên</strong> ·{" "}
              {roster.data.data.totalEnrollments} lượt đăng ký buổi học (đang
              giữ chỗ hoặc đã hoàn tất).
            </p>
            {!roster.data.data.members.length ? (
              <Empty text="Chưa có hội viên đăng ký" />
            ) : (
              <div
                className="table-scroll"
                tabIndex={0}
                role="region"
                aria-label="Hội viên đăng ký khóa học, có thể cuộn ngang"
              >
                <table>
                  <thead>
                    <tr>
                      <th>Hội viên</th>
                      <th>Đang đăng ký</th>
                      <th>Đã hoàn tất</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roster.data.data.members.map((m) => (
                      <tr key={m.memberId}>
                        <td>
                          <strong>{m.fullName}</strong>
                          <div>{m.email}</div>
                        </td>
                        <td>{m.bookedSessions}</td>
                        <td>{m.completedSessions}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>
      <section className="detail-section">
        <h3>Lịch của khóa học</h3>
        {roster.isPending ? (
          <Loading />
        ) : roster.error ? (
          <ErrorState error={roster.error} />
        ) : !sessions.length ? (
          <Empty text="Chưa có buổi học trong kế hoạch" />
        ) : (
          <div
            className="table-scroll"
            tabIndex={0}
            role="region"
            aria-label="Lịch của khóa học, có thể cuộn ngang"
          >
            <table>
              <thead>
                <tr>
                  <th>Buổi học</th>
                  <th>Phòng</th>
                  <th>Đăng ký</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={String(s.id)}>
                    <td>
                      {display(s.startTime)}
                      <div>{display(s.endTime)}</div>
                    </td>
                    <td>{display(at(s, "room.name"))}</td>
                    <td>{display(at(s, "_count.enrollments"))}</td>
                    <td>{display(s.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
