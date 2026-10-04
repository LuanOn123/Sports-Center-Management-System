import type { ReactNode } from "react";
import { Building2, Dumbbell, Users, CreditCard } from "lucide-react";
import type { RecordData } from "./api";
import { at, display, money } from "./config";
import { StatusBadge } from "./StatusBadge";

export function ResourceCollection({
  rows,
  columns,
  kind,
  actions,
}: {
  rows: RecordData[];
  columns: [string, string][];
  kind: string;
  actions: (row: RecordData) => ReactNode;
}) {
  const people = ["coaches", "staff"].includes(kind);
  const Icon =
    kind === "rooms"
      ? Building2
      : people
        ? Users
        : kind === "membership-plans"
          ? CreditCard
          : Dumbbell;
  return (
    <div className={`resource-grid resource-${kind}`}>
      {rows.map((row) => (
        <article className="resource-card" key={String(row.id)}>
          <div className="resource-visual" aria-hidden="true">
            {people ? (
              <span className="resource-initials">
                {String(at(row, columns[0][0]) || "?")
                  .slice(0, 2)
                  .toUpperCase()}
              </span>
            ) : (
              <Icon size={36} strokeWidth={1.3} />
            )}
            {!people && <span className="court-lines" />}
          </div>
          <div className="resource-card-body">
            <div className="resource-card-heading">
              <h3>{display(at(row, columns[0][0]))}</h3>
              {typeof row.isActive === "boolean" && (
                <StatusBadge value={row.isActive} />
              )}
            </div>
            <dl className="resource-facts">
              {columns
                .slice(1)
                .filter(([key]) => key !== "isActive")
                .map(([key, title]) => (
                  <div key={key}>
                    <dt>{title}</dt>
                    <dd>
                      {key === "price"
                        ? money(at(row, key))
                        : display(at(row, key))}
                    </dd>
                  </div>
                ))}
            </dl>
          </div>
          <div className="resource-card-footer">{actions(row)}</div>
        </article>
      ))}
    </div>
  );
}
