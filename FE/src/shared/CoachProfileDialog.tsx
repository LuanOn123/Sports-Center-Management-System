import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Award, Dumbbell, UserRound } from "lucide-react";
import type { CoachInfo } from "../types/member";
import { api } from "./api";
import { Avatar } from "./Avatar";
import { CoachFeedback } from "./CoachFeedback";
import { ErrorState, Loading, Modal } from "./ui";
import "./coach-profile-dialog.css";

type CoachDetails = {
  fullName: string;
  avatarUrl?: string | null;
  coachProfile?: {
    bio?: string | null;
    specialization?: string | null;
    experienceYears?: number | null;
    specializations?: { sport?: { name: string } }[];
  } | null;
};

export function CoachCard({
  assigned,
  onClick,
}: {
  assigned: CoachInfo;
  onClick: () => void;
}) {
  const coach = assigned.coach;
  return (
    <button
      type="button"
      className="member-coach-card"
      onClick={onClick}
      aria-label={`Xem hồ sơ ${coach.user.fullName}`}
    >
      <Avatar user={coach.user} interactive={false} />
      <span className="member-coach-card-copy">
        <span className="member-coach-role">
          {assigned.isPrimary
            ? "HUẤN LUYỆN VIÊN CHÍNH"
            : "HUẤN LUYỆN VIÊN HỖ TRỢ"}
        </span>
        <strong>{coach.user.fullName}</strong>
        <span>{coach.specialization || "Huấn luyện viên Pulse"}</span>
        <span className="member-coach-card-link">
          Hồ sơ & đánh giá <ArrowUpRight size={15} aria-hidden="true" />
        </span>
      </span>
    </button>
  );
}

export function CoachProfileDialog({
  assigned,
  classId,
  canReview,
  onClose,
}: {
  assigned: CoachInfo;
  classId: string;
  canReview: boolean;
  onClose: () => void;
}) {
  const coach = assigned.coach;
  const details = useQuery({
    queryKey: ["member-coach-profile", coach.user.id],
    queryFn: ({ signal }) =>
      api<CoachDetails>("GET /coaches/{id}", {
        params: { id: coach.user.id },
        signal,
      }),
    enabled: Boolean(coach.user.id),
  });
  const profile = details.data?.data.coachProfile;
  const fullName = details.data?.data.fullName || coach.user.fullName;
  const bio = profile?.bio ?? coach.bio;
  const years = profile?.experienceYears ?? coach.experienceYears;
  const specialties = [
    ...new Set(
      [
        profile?.specialization ?? coach.specialization,
        ...(profile?.specializations?.map((item) => item.sport?.name) || []),
      ].filter(Boolean),
    ),
  ];
  return (
    <Modal title="Hồ sơ huấn luyện viên" maxWidth={780} onClose={onClose}>
      <div className="member-coach-profile">
        <header className="member-coach-profile-hero">
          <Avatar
            user={{
              fullName,
              avatarUrl: details.data?.data.avatarUrl ?? coach.user.avatarUrl,
            }}
          />
          <div>
            <span className="member-coach-role">PULSE SPORTS CENTER</span>
            <h3>{fullName}</h3>
            <p>
              {assigned.isPrimary
                ? "Huấn luyện viên chính của lớp"
                : "Huấn luyện viên hỗ trợ của lớp"}
            </p>
          </div>
        </header>
        {details.isFetching && <Loading variant="field" />}
        {details.error && (
          <ErrorState error={details.error} retry={() => details.refetch()} />
        )}
        <div className="member-coach-profile-facts">
          <section>
            <h3>
              <Dumbbell size={18} aria-hidden="true" /> Chuyên môn
            </h3>
            {specialties.length ? (
              <div className="member-coach-specialties">
                {specialties.map((name) => (
                  <span key={name}>{name}</span>
                ))}
              </div>
            ) : (
              <p>Chưa cập nhật chuyên môn.</p>
            )}
          </section>
          <section>
            <h3>
              <Award size={18} aria-hidden="true" /> Kinh nghiệm
            </h3>
            <p>
              {years != null
                ? `${years} năm huấn luyện`
                : "Chưa cập nhật kinh nghiệm."}
            </p>
          </section>
        </div>
        <section className="member-coach-bio">
          <h3>
            <UserRound size={18} aria-hidden="true" /> Giới thiệu
          </h3>
          <p>{bio || "Huấn luyện viên chưa cập nhật phần giới thiệu."}</p>
        </section>
        <div className="member-coach-reviews">
          <CoachFeedback
            coachId={coach.id}
            reviewClassId={classId}
            role="MEMBER"
            canReview={canReview}
          />
          {!canReview && (
            <p className="field-note">
              Bạn có thể viết đánh giá sau khi đã tham gia ít nhất một buổi của
              lớp này do huấn luyện viên dạy.
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}
