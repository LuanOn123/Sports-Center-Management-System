import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import { getFacilityId } from "../facility";
import { allPages } from "../pagedApi";
import { ErrorState, Loading } from "../feedback";
import { CoachSportChoices } from "../../features/manage/CoachExpertiseFields";
import { AreaTypePicker } from "./AreaTypePicker";
import "./create-coach-form.css";
import { UserFacilityField } from "./UserFacilityField";
export type CoachDraft = {
  fullName: string;
  email: string;
  password: string;
  phone: string;
  gender: "MALE" | "FEMALE" | "OTHER";
  experienceYears: string;
  bio: string;
  sportIds: string[];
  facilityId: string;
};

export function CreateCoachForm({
  onClose,
  onCancel = onClose,
  system = false,
  onBusyChange,
  initial,
  onDraftChange,
}: {
  onClose: () => void;
  onCancel?: () => void;
  system?: boolean;
  onBusyChange?: (busy: boolean) => void;
  initial?: Partial<CoachDraft>;
  onDraftChange?: (draft: CoachDraft) => void;
}) {
  const facilityId = getFacilityId();
  const cache = useQueryClient();
  const [fullName, setFullName] = useState(initial?.fullName ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [password, setPassword] = useState(initial?.password ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [gender, setGender] = useState<CoachDraft["gender"]>(
    initial?.gender ?? "MALE",
  );
  const [experienceYears, setExperienceYears] = useState(
    initial?.experienceYears ?? "",
  );
  const [bio, setBio] = useState(initial?.bio ?? "");
  const [selectedSports, setSelectedSports] = useState<string[]>(
    initial?.sportIds ?? [],
  );
  const [error, setError] = useState<unknown>();
  const [assignedFacility, setAssignedFacility] = useState(initial?.facilityId ?? "");
  const [showNewSport, setShowNewSport] = useState(false);
  const [sportName, setSportName] = useState("");
  const [sportArea, setSportArea] = useState("INDOOR");
  const [sportError, setSportError] = useState<unknown>();
  useEffect(() => {
    onDraftChange?.({
      fullName,
      email,
      password,
      phone,
      gender,
      experienceYears,
      bio,
      sportIds: selectedSports,
      facilityId: assignedFacility,
    });
  }, [
    fullName,
    email,
    password,
    phone,
    gender,
    experienceYears,
    bio,
    selectedSports,
    onDraftChange,
    assignedFacility,
  ]);

  const sportsQuery = useQuery({
    queryKey: ["all-sports"],
    queryFn: ({ signal }) =>
      allPages<{ id: string; name: string; isActive?: boolean }>(
        "GET /sports",
        { signal },
      ),
  });

  const activeSports = (sportsQuery.data?.data ?? []).filter(
    (s) => s.isActive !== false,
  );
  const createSport = useMutation({
    mutationFn: async () => {
      const name = sportName.trim();
      if (name.length < 2)
        throw new Error("Tên bộ môn phải có ít nhất 2 ký tự.");
      if (
        sportsQuery.data?.data.some(
          (sport) =>
            sport.name.trim().toLocaleLowerCase("vi") ===
            name.toLocaleLowerCase("vi"),
        )
      ) {
        throw new Error(
          "Bộ môn đã có trong hệ thống. Vui lòng chọn trong danh sách.",
        );
      }
      return api<{ id: string; name: string; isActive?: boolean }>(
        "POST /sports",
        {
          body: { name, areaTypes: [sportArea] },
        },
      );
    },
    onMutate: () => {
      setSportError(undefined);
      onBusyChange?.(true);
    },
    onSettled: () => onBusyChange?.(false),
    onSuccess: (result) => {
      cache.setQueryData<typeof sportsQuery.data>(["all-sports"], (current) =>
        current
          ? { ...current, data: [...current.data, result.data] }
          : current,
      );
      setSelectedSports((current) => [
        ...new Set([...current, result.data.id]),
      ]);
      setSportName("");
      setShowNewSport(false);
      void cache.invalidateQueries({ queryKey: ["all-sports"] });
      void cache.invalidateQueries({ queryKey: ["resource", "sports"] });
      void cache.invalidateQueries({ queryKey: ["lookup", "/sports"] });
    },
    onError: setSportError,
  });

  const createCoach = useMutation({
    mutationFn: async () => {
      if (!selectedSports.length) {
        throw new Error("Bắt buộc chọn ít nhất một bộ môn.");
      }
      return api(
        system ? "POST /users" : "POST /facilities/{facilityId}/coaches",
        {
          params: { facilityId },
          body: {
            fullName: fullName.trim(),
            email: email.trim(),
            password: password || (system ? "Coach@123456" : undefined),
            ...(system ? { role: "COACH" } : {}),
            ...(system && assignedFacility ? { facilityId: assignedFacility } : {}),
            phone: phone.trim() || undefined,
            gender,
            experienceYears: experienceYears
              ? Number(experienceYears)
              : undefined,
            bio: bio.trim() || undefined,
            sportIds: selectedSports,
          },
        },
      );
    },
    onMutate: () => onBusyChange?.(true),
    onSettled: () => onBusyChange?.(false),
    onSuccess: async () => {
      void cache.invalidateQueries({ queryKey: ["resource"] });
      await cache.invalidateQueries({
        queryKey: ["manager-staff", facilityId],
      });
      await cache.invalidateQueries({ queryKey: ["qualified-coaches"] });
      await cache.invalidateQueries({ queryKey: ["manager-candidates"] });
      onClose();
    },
    onError: (err) => {
      setError(err);
    },
  });

  const isValid =
    fullName.trim().length >= 2 &&
    email.trim().length > 0 &&
    selectedSports.length > 0;
  const busy = createCoach.isPending || createSport.isPending;

  return (
    <form
      className="manager-config-form create-coach-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (showNewSport) {
          if (!busy) createSport.mutate();
        } else if (isValid && !busy) {
          setError(undefined);
          createCoach.mutate();
        }
      }}
    >
      <p className="field-note">
        {system
          ? "Tạo HLV và chọn cơ sở phân công, hoặc để trống để phân công sau."
          : "Tạo HLV và phân công trực tiếp vào cơ sở này."}{" "}
        Bắt buộc chọn ít nhất 1 bộ môn giảng dạy.
      </p>

      {Boolean(error) && <ErrorState error={error} />}

      <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0 }}>
        <div className="form-grid">
          {system && <UserFacilityField value={assignedFacility} onChange={setAssignedFacility} />}
          <label>
            <span className="form-field-label">
              Họ và tên{"\u00a0"}
              <span className="required">*</span>
            </span>
            <input
              required
              minLength={2}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Nguyễn Văn A"
            />
          </label>

          <label>
            <span className="form-field-label">
              Email{"\u00a0"}
              <span className="required">*</span>
            </span>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="coach@example.com"
            />
          </label>

          <label>
            Mật khẩu
            <input
              type="password"
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mặc định: Coach@123456"
            />
          </label>

          <label>
            Số điện thoại
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0901234567"
            />
          </label>

          <label>
            Giới tính
            <select
              value={gender}
              onChange={(e) => {
                const next = e.target.value;
                if (next === "MALE" || next === "FEMALE" || next === "OTHER")
                  setGender(next);
              }}
            >
              <option value="MALE">Nam</option>
              <option value="FEMALE">Nữ</option>
              <option value="OTHER">Khác</option>
            </select>
          </label>

          <label>
            Số năm kinh nghiệm
            <input
              type="number"
              min="0"
              value={experienceYears}
              onChange={(e) => setExperienceYears(e.target.value)}
              placeholder="Ví dụ: 3"
            />
          </label>
        </div>

        <label style={{ display: "block", marginTop: "12px" }}>
          Giới thiệu / Tiểu sử
          <textarea
            rows={2}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Chứng chỉ, phong cách huấn luyện..."
          />
        </label>

        <fieldset className="create-coach-sports" disabled={busy}>
          <legend>
            <span className="form-field-label">
              Bộ môn giảng dạy{"\u00a0"}
              <span className="required">*</span> (Bắt buộc chọn ít nhất 1 môn)
            </span>
          </legend>
          {sportsQuery.isPending ? (
            <Loading />
          ) : sportsQuery.error ? (
            <ErrorState
              error={sportsQuery.error}
              retry={() => sportsQuery.refetch()}
            />
          ) : (
            <CoachSportChoices
              sports={activeSports}
              selected={selectedSports}
              onChange={setSelectedSports}
            />
          )}
          {system && !showNewSport && (
            <button
              type="button"
              className="button small create-coach-add-sport"
              onClick={() => {
                setSportError(undefined);
                setShowNewSport(true);
              }}
            >
              + Tạo bộ môn mới
            </button>
          )}
          {system && showNewSport && (
            <section
              className="create-coach-new-sport"
              aria-label="Tạo bộ môn mới"
            >
              <h3>Tạo bộ môn mới</h3>
              <label>
                Tên bộ môn
                <input
                  value={sportName}
                  onChange={(event) => setSportName(event.target.value)}
                  placeholder="Ví dụ: Pickleball"
                />
              </label>
              <AreaTypePicker value={sportArea} onChange={setSportArea} />
              <p className="field-note">
                Bộ môn được lưu vào hệ thống và tự động chọn cho HLV này.
              </p>
              {sportError != null && <ErrorState error={sportError} />}
              <div className="workflow-actions">
                <button
                  type="button"
                  className="button"
                  onClick={() => setShowNewSport(false)}
                >
                  Hủy tạo môn
                </button>
                <button
                  type="button"
                  className="button primary"
                  disabled={
                    sportName.trim().length < 2 ||
                    sportsQuery.isPending ||
                    sportsQuery.isError
                  }
                  onClick={() => createSport.mutate()}
                >
                  {createSport.isPending ? "Đang lưu…" : "Lưu bộ môn"}
                </button>
              </div>
            </section>
          )}
          {!selectedSports.length && (
            <p
              className="field-note"
              style={{
                color: "var(--color-danger, #ef4444)",
                marginTop: "4px",
              }}
            >
              Vui lòng chọn ít nhất một bộ môn.
            </p>
          )}
        </fieldset>
      </fieldset>
      <div className="modal-footer" style={{ marginTop: "20px" }}>
        <button
          type="button"
          className="button"
          onClick={onCancel}
          disabled={busy}
        >
          Hủy
        </button>
        <button
          type="submit"
          className="button primary"
          disabled={!isValid || busy || showNewSport}
        >
          {createCoach.isPending ? "Đang tạo…" : "Tạo Huấn luyện viên"}
        </button>
      </div>
    </form>
  );
}
