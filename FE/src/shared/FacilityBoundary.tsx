import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useIsMutating, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import {
  getFacilityId,
  selectFacility,
  mutationCount,
  subscribeMutations,
} from "./facility";
import { ErrorState, Loading } from "./ui";
export type Facility = {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
};
const FacilityContext = createContext<{
  facilities: Facility[];
  selected: string;
  busy: boolean;
  change: (id: string) => Promise<void>;
} | null>(null);
export function FacilityPicker() {
  const context = useContext(FacilityContext);
  if (!context) return null;
  return (
    <label className="facility-switch">
      Cơ sở
      <select
        aria-label="Cơ sở đang làm việc"
        disabled={context.busy}
        value={context.selected}
        onChange={(e) => void context.change(e.target.value)}
      >
        {context.facilities.map((f) => (
          <option value={f.id} key={f.id}>
            {f.name}
          </option>
        ))}
      </select>
    </label>
  );
}
export function FacilityBoundary({
  children,
  admin,
  onLogout,
}: {
  children: ReactNode;
  admin: boolean;
  onLogout: () => Promise<void>;
}) {
  const cache = useQueryClient();
  const busy = useIsMutating();
  const pendingRequests = useSyncExternalStore(
    subscribeMutations,
    mutationCount,
  );
  const [selected, setSelected] = useState(getFacilityId());
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState<unknown>();
  const q = useQuery({
    queryKey: ["facilities"],
    queryFn: ({ signal }) => api<Facility[]>("GET /facilities", { signal }),
  });
  const valid = q.data?.data.some((f) => f.id === selected);
  useEffect(() => {
    if (q.data && !valid) {
      const first = q.data.data[0]?.id || "";
      selectFacility(first);
      setSelected(first);
    }
  }, [q.data, valid]);
  async function change(id: string) {
    if (mutationCount()) return;
    await cache.cancelQueries({
      predicate: (query) =>
        !["me", "facilities"].includes(String(query.queryKey[0])),
    });
    selectFacility(id);
    cache.removeQueries({
      predicate: (query) =>
        !["me", "facilities"].includes(String(query.queryKey[0])),
    });
    setSelected(id);
  }
  if (q.isPending)
    return (
      <div className="fullscreen">
        <Loading />
      </div>
    );
  if (q.error)
    return (
      <div className="fullscreen">
        <ErrorState error={q.error} retry={() => q.refetch()} />
        <button className="button" onClick={onLogout}>
          Đăng xuất
        </button>
      </div>
    );
  if (!q.data.data.length)
    return (
      <div className="fullscreen">
        <h1>{admin ? "Thêm cơ sở đầu tiên" : "Chưa được phân công cơ sở"}</h1>
        {admin && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await api("POST /facilities", {
                  body: { name, code, address },
                });
                await q.refetch();
              } catch (e) {
                setError(e);
              }
            }}
          >
            <label>
              Tên cơ sở
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label>
              Mã cơ sở
              <input
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </label>
            <label>
              Địa chỉ
              <input
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </label>
            <button className="button primary">Tạo cơ sở</button>
          </form>
        )}
        {error != null && <ErrorState error={error} />}
        <button className="button" onClick={onLogout}>
          Đăng xuất
        </button>
      </div>
    );
  if (!valid)
    return (
      <div className="fullscreen">
        <Loading />
      </div>
    );
  return (
    <FacilityContext.Provider
      value={{
        facilities: q.data.data,
        selected,
        busy: busy > 0 || pendingRequests > 0,
        change,
      }}
    >
      <div key={selected}>{children}</div>
    </FacilityContext.Provider>
  );
}
