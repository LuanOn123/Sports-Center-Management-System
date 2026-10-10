import { Avatar } from "./Avatar";
import type { ReactNode } from "react";
import type { RecordData } from "./api";
import { at, display, money } from "./config";
import { Empty } from "./ui";
import { StatusBadge } from "./StatusBadge";
export function Table({
  rows,
  columns,
  actions,
}: {
  rows: RecordData[];
  columns: [string, string][];
  actions?: (row: RecordData) => ReactNode;
}) {
  if (!rows.length) return <Empty />;
  return (
    <div
      className="table-scroll"
      tabIndex={0}
      role="region"
      aria-label="Bảng dữ liệu, có thể cuộn ngang"
    >
      <table>
        <thead>
          <tr>
            {columns.map(([key, title]) => (
              <th
                key={key}
                scope="col"
                className={
                  ["amount", "total", "price"].includes(key)
                    ? "numeric"
                    : undefined
                }
              >
                {title}
              </th>
            ))}
            {actions && <th scope="col">Thao tác</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={String(row.id ?? index)}>
              {columns.map(([key]) => (
                <td
                  key={key}
                  className={
                    ["amount", "total", "price"].includes(key)
                      ? "numeric"
                      : undefined
                  }
                >
                  {["amount", "total", "price"].includes(key) ? (
                    money(at(row, key))
                  ) : ["status", "tier", "isActive", "classType"].includes(
                      key,
                    ) ? (
                    <StatusBadge value={at(row, key)} />
                  ) : key.endsWith("fullName") ? (
                    <div className="name-cell">
                      <Avatar
                        user={{
                          fullName: String(at(row, key) || "?"),
                          avatarUrl:
                            typeof at(
                              row,
                              key.replace(/fullName$/, "avatarUrl"),
                            ) === "string"
                              ? String(
                                  at(
                                    row,
                                    key.replace(/fullName$/, "avatarUrl"),
                                  ),
                                )
                              : undefined,
                        }}
                      />
                      <strong>{display(at(row, key))}</strong>
                    </div>
                  ) : (
                    display(at(row, key))
                  )}
                </td>
              ))}
              {actions && (
                <td>
                  <div className="reception-actions">{actions(row)}</div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
