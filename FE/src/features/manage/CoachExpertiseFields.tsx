import { useId } from "react";
import { Empty } from "../../shared/ui";
import "./coach-expertise.css";

export type CoachSportOption = {
  id: string;
  name: string;
  isActive?: boolean;
};

export function CoachExperienceField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const suggestionsId = useId();
  return (
    <label>
      Số năm kinh nghiệm
      <input
        type="number"
        min={0}
        step={1}
        list={suggestionsId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Ví dụ: 3"
      />
      <datalist id={suggestionsId}>
        {Array.from({ length: 21 }, (_, years) => (
          <option key={years} value={years} label={`${years} năm`} />
        ))}
      </datalist>
    </label>
  );
}

export function CoachSportChoices({
  sports,
  selected,
  onChange,
}: {
  sports: CoachSportOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
}) {
  const visible = sports.filter(
    (sport) => sport.isActive !== false || selected.includes(sport.id),
  );
  return visible.length ? (
    <div className="coach-sport-options">
      {visible.map((sport) => (
        <label key={sport.id} className="coach-sport-option">
          <input
            type="checkbox"
            checked={selected.includes(sport.id)}
            onChange={(event) =>
              onChange(
                event.target.checked
                  ? [...selected, sport.id]
                  : selected.filter((id) => id !== sport.id),
              )
            }
          />
          <span>
            {sport.name}
            {sport.isActive === false && " (ngừng hoạt động)"}
          </span>
        </label>
      ))}
    </div>
  ) : (
    <Empty text="Không có bộ môn khả dụng" />
  );
}
