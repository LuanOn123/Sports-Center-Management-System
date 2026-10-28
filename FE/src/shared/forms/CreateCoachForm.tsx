import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import { getFacilityId } from "../facility";
import { allPages } from "../pagedApi";
import { Empty, ErrorState, Loading } from "../feedback";
export function CreateCoachForm({
  onClose,
  onCancel = onClose,
  system = false,
  onBusyChange,
}: {
  onClose: () => void;
  onCancel?: () => void;
  system?: boolean;
  onBusyChange?: (busy: boolean) => void;
}) {
  const facilityId = getFacilityId();
  const cache = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState<"MALE" | "FEMALE" | "OTHER">("MALE");
  const [experienceYears, setExperienceYears] = useState("");
  const [bio, setBio] = useState("");
  const [selectedSports, setSelectedSports] = useState<string[]>([]);
  const [error, setError] = useState<unknown>();

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

  return (
    <form
      className="manager-config-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (isValid && !createCoach.isPending) {
          setError(undefined);
          createCoach.mutate();
        }
      }}
    >
      <p className="field-note">
        {system
          ? "Tạo HLV hệ thống, chờ quản lý phân công vào cơ sở."
          : "Tạo HLV và phân công trực tiếp vào cơ sở này."}{" "}
        Bắt buộc chọn ít nhất 1 bộ môn giảng dạy.
      </p>

      {Boolean(error) && <ErrorState error={error} />}

      <fieldset
        disabled={createCoach.isPending}
        style={{ border: 0, padding: 0, margin: 0 }}
      >
        <div className="form-grid">
          <label>
            Họ và tên *
            <input
              required
              minLength={2}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Nguyễn Văn A"
            />
          </label>

          <label>
            Email *
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
              onChange={(e) => setGender(e.target.value as any)}
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

        <fieldset
          style={{ marginTop: "16px" }}
          disabled={createCoach.isPending}
        >
          <legend>Bộ môn giảng dạy * (Bắt buộc chọn ít nhất 1 môn)</legend>
          {sportsQuery.isPending ? (
            <Loading />
          ) : sportsQuery.error ? (
            <ErrorState
              error={sportsQuery.error}
              retry={() => sportsQuery.refetch()}
            />
          ) : !activeSports.length ? (
            <Empty text="Không có bộ môn khả dụng" />
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                gap: "8px",
                marginTop: "8px",
              }}
            >
              {activeSports.map((s) => (
                <label
                  key={s.id}
                  style={{ display: "flex", alignItems: "center", gap: "6px" }}
                >
                  <input
                    type="checkbox"
                    checked={selectedSports.includes(s.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedSports([...selectedSports, s.id]);
                      } else {
                        setSelectedSports(
                          selectedSports.filter((id) => id !== s.id),
                        );
                      }
                    }}
                  />
                  {s.name}
                </label>
              ))}
            </div>
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
          disabled={createCoach.isPending}
        >
          Hủy
        </button>
        <button
          type="submit"
          className="button primary"
          disabled={!isValid || createCoach.isPending}
        >
          {createCoach.isPending ? "Đang tạo…" : "Tạo Huấn luyện viên"}
        </button>
      </div>
    </form>
  );
}
