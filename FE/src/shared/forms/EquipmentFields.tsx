type Values = Record<string, number>;
export const EQUIPMENT_KEY = "training_equipment";
export function equipmentValues(
  value: unknown,
  quantity: "quantity" | "minimum",
): Values {
  if (Array.isArray(value))
    return Object.fromEntries(value.map((row) => [row.key, row[quantity]]));
  return value && typeof value === "object" ? (value as Values) : {};
}
export function EquipmentFields({
  value,
  onChange,
  subject = false,
}: {
  value: Values;
  onChange: (value: Values) => void;
  subject?: boolean;
}) {
  const enabled = Object.values(value).some((count) => count > 0);
  return (
    <fieldset className="equipment-fields wide">
      <legend>
        {subject
          ? "Yêu cầu dụng cụ cho phòng trong nhà"
          : "Dụng cụ trong phòng"}
      </legend>
      <div className="equipment-options">
        {[true, false].map((has) => (
          <label
            className={
              enabled === has ? "equipment-option selected" : "equipment-option"
            }
            key={String(has)}
          >
            <input
              type="radio"
              name={subject ? "subject-equipment" : "room-equipment"}
              checked={enabled === has}
              onChange={() => onChange(has ? { [EQUIPMENT_KEY]: 1 } : {})}
            />
            {has ? "Có dụng cụ" : "Không có dụng cụ"}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
export function hasEquipment(
  requirements: { key: string; minimum: number }[],
  capabilities: { key: string; quantity: number }[] = [],
  areaType = "INDOOR",
) {
  return (
    areaType !== "INDOOR" ||
    !requirements.some((row) => row.minimum > 0) ||
    capabilities.some((row) => row.quantity > 0)
  );
}
