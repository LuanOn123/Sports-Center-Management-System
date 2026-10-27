import { useId } from "react";
import { Building2, Trees, Waves, Check } from "lucide-react";
import "./form-design.css";

export const areaOptions = [
  {
    value: "INDOOR",
    title: "Trong nhà",
    description: "Phòng tập, nhà thi đấu",
    Icon: Building2,
  },
  {
    value: "OUTDOOR",
    title: "Ngoài trời",
    description: "Sân tập, không gian mở",
    Icon: Trees,
  },
  {
    value: "POOL",
    title: "Hồ bơi",
    description: "Bơi lội, thể thao dưới nước",
    Icon: Waves,
  },
] as const;

export function AreaTypePicker({
  value,
  onChange,
  label = "Loại khu vực",
  required = false,
  allowed,
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  required?: boolean;
  allowed?: readonly string[];
}) {
  const id = useId();
  return (
    <fieldset className="area-type-picker wide">
      <legend>
        {label}
        {required && <span className="required"> *</span>}
      </legend>
      <div className="area-type-options">
        {areaOptions
          .filter((option) => !allowed || allowed.includes(option.value))
          .map(({ value: option, title, description, Icon }) => (
            <label className="area-type-option" key={option}>
              <input
                type="radio"
                name={id}
                value={option}
                checked={value === option}
                required={required}
                onChange={() => onChange(option)}
              />
              <span className="area-type-content">
                <span className="area-type-icon">
                  <Icon size={27} strokeWidth={1.6} aria-hidden="true" />
                </span>
                <strong>{title}</strong>
                <small>{description}</small>
                <Check
                  className="area-type-check"
                  size={16}
                  aria-hidden="true"
                />
              </span>
            </label>
          ))}
      </div>
    </fieldset>
  );
}
