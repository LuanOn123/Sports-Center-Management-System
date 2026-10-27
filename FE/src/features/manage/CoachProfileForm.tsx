import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, type RecordData } from "../../shared/api";
import { canTeach } from "../../shared/coachEligibility";
import { ErrorState, Loading } from "../../shared/ui";
import {
  CoachExperienceField,
  CoachSportChoices,
} from "./CoachExpertiseFields";
import { useCoachSports, validateCoachSports } from "./coachProfileData";

export function CoachProfileForm({
  id,
  initial,
  profileId,
  onBusyChange,
  onSuccess,
  onCancel,
}: {
  id: string;
  initial: RecordData;
  profileId: string;
  onBusyChange: (busy: boolean) => void;
  onSuccess: () => Promise<void>;
  onCancel: () => void;
}) {
  const cache = useQueryClient();
  const sports = useCoachSports(profileId);
  const [fields, setFields] = useState(() => ({
    fullName: String(initial.fullName ?? ""),
    phone: String(initial.phone ?? ""),
    gender: String(initial.gender ?? ""),
    dateOfBirth: String(initial.dateOfBirth ?? "").slice(0, 10),
    specialization: String(initial.specialization ?? ""),
    experienceYears:
      initial.experienceYears == null ? "" : String(initial.experienceYears),
    bio: String(initial.bio ?? ""),
  }));
  const [selection, setSelection] = useState<string[]>();
  const [savedSelection, setSavedSelection] = useState<string[]>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const [partialSave, setPartialSave] = useState(false);
  const selected = selection ?? sports.data?.assigned ?? [];
  const baseline = savedSelection ?? sports.data?.assigned ?? [];
  const coversClasses =
    !sports.data?.requiredSports.length ||
    canTeach(sports.data.requiredSports, selected);
  const inactiveSelected = sports.data?.sports.some(
    (sport) => sport.isActive === false && selected.includes(sport.id),
  );
  function change(key: keyof typeof fields, value: string) {
    setFields((current) => ({ ...current, [key]: value }));
  }

  if (sports.isPending) return <Loading />;
  if (sports.error)
    return <ErrorState error={sports.error} retry={() => sports.refetch()} />;

  return (
    <form
      className="manager-config-form coach-profile-form"
      aria-busy={busy}
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy) return;
        setError(undefined);
        if (!selected.length || !coversClasses || inactiveSelected) return;
        if (fields.fullName.trim().length < 2) {
          setError(new Error("Họ và tên phải có ít nhất 2 ký tự."));
          return;
        }
        if (!/^[0-9+\-() ]*$/.test(fields.phone.trim())) {
          setError(
            new Error(
              "Số điện thoại chỉ được chứa số, khoảng trắng và các ký tự + - ( ).",
            ),
          );
          return;
        }
        if (
          fields.experienceYears !== "" &&
          (!Number.isSafeInteger(Number(fields.experienceYears)) ||
            Number(fields.experienceYears) < 0)
        ) {
          setError(new Error("Số năm kinh nghiệm phải là số nguyên không âm."));
          return;
        }
        if (
          fields.dateOfBirth &&
          (!Number.isFinite(Date.parse(fields.dateOfBirth)) ||
            Date.parse(fields.dateOfBirth) > Date.now())
        ) {
          setError(new Error("Ngày sinh phải hợp lệ và không ở tương lai."));
          return;
        }
        const sportsChanged =
          selected.length !== baseline.length ||
          selected.some((sportId) => !baseline.includes(sportId));
        let savedSports = false;
        setBusy(true);
        onBusyChange(true);
        try {
          if (sportsChanged) {
            await validateCoachSports(profileId, selected);
            await api("PUT /coaches/{id}/specializations", {
              params: { id: profileId },
              body: { sportIds: selected },
            });
            savedSports = true;
            setSavedSelection([...selected]);
            setPartialSave(true);
          }
          await api("PATCH /coaches/{id}", {
            params: { id },
            body: {
              fullName: fields.fullName.trim(),
              phone: fields.phone.trim(),
              ...(fields.gender ? { gender: fields.gender } : {}),
              ...(fields.dateOfBirth
                ? { dateOfBirth: fields.dateOfBirth }
                : {}),
              ...(fields.specialization.trim()
                ? { specialization: fields.specialization.trim() }
                : {}),
              ...(fields.experienceYears !== ""
                ? { experienceYears: Number(fields.experienceYears) }
                : {}),
              bio: fields.bio.trim(),
            },
          });
          setPartialSave(false);
          await onSuccess();
        } catch (err) {
          setError(err);
          if (savedSports) void cache.invalidateQueries();
        } finally {
          setBusy(false);
          onBusyChange(false);
        }
      }}
    >
      <fieldset className="form-grid" disabled={busy}>
        <label>
          Họ và tên *
          <input
            required
            minLength={2}
            value={fields.fullName}
            onChange={(event) => change("fullName", event.target.value)}
          />
        </label>
        <label>
          Email
          <input type="email" value={String(initial.email ?? "")} readOnly />
        </label>
        <label>
          Số điện thoại
          <input
            type="tel"
            value={fields.phone}
            onChange={(event) => change("phone", event.target.value)}
          />
        </label>
        <label>
          Giới tính
          <select
            value={fields.gender}
            onChange={(event) => change("gender", event.target.value)}
          >
            <option value="">Chưa cập nhật</option>
            <option value="MALE">Nam</option>
            <option value="FEMALE">Nữ</option>
            <option value="OTHER">Khác</option>
          </select>
        </label>
        <label>
          Ngày sinh
          <input
            type="date"
            value={fields.dateOfBirth}
            onChange={(event) => change("dateOfBirth", event.target.value)}
          />
        </label>
        <CoachExperienceField
          value={fields.experienceYears}
          onChange={(value) => change("experienceYears", value)}
        />
        <label className="wide">
          Mô tả chuyên môn
          <input
            value={fields.specialization}
            onChange={(event) => change("specialization", event.target.value)}
          />
          <small className="field-note">
            Mô tả bổ sung; bộ môn được phép giảng dạy chọn ở bên dưới.
          </small>
        </label>
        <label className="wide">
          Giới thiệu / Tiểu sử
          <textarea
            rows={2}
            value={fields.bio}
            onChange={(event) => change("bio", event.target.value)}
          />
        </label>
      </fieldset>
      <fieldset disabled={busy}>
        <legend>Bộ môn giảng dạy * (Bắt buộc chọn ít nhất 1 môn)</legend>
        <CoachSportChoices
          sports={sports.data.sports}
          selected={selected}
          onChange={setSelection}
        />
        {!selected.length && (
          <p className="field-note">Vui lòng chọn ít nhất một bộ môn.</p>
        )}
        {!coversClasses && (
          <p role="alert">
            Không thể gỡ bộ môn của lớp HLV đang phụ trách. Điều chỉnh phân công
            lớp trước khi bỏ bộ môn.
          </p>
        )}
        {inactiveSelected && (
          <p role="alert">
            Bỏ chọn bộ môn đã ngừng hoạt động trước khi lưu. Nếu môn đang được
            lớp sử dụng, hãy điều chỉnh phân công lớp trước.
          </p>
        )}
      </fieldset>
      {error != null && <ErrorState error={error} />}
      {partialSave && (
        <p role="status">
          Bộ môn đã được lưu, nhưng thông tin hồ sơ chưa lưu xong. Bạn có thể
          thử lưu lại mà không cần chọn lại bộ môn.
        </p>
      )}
      <div className="modal-footer">
        <button
          type="button"
          className="button"
          disabled={busy}
          onClick={onCancel}
        >
          Hủy
        </button>
        <button
          className="button primary"
          disabled={
            busy || !selected.length || !coversClasses || !!inactiveSelected
          }
        >
          {busy ? "Đang lưu…" : "Lưu thay đổi"}
        </button>
      </div>
    </form>
  );
}
