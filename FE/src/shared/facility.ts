let selected = sessionStorage.getItem("pulse.facility") || "";
let requests = new AbortController();
let mutations = 0;
const listeners = new Set<() => void>();
export const mutationCount = () => mutations;
export const subscribeMutations = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export function trackMutation(delta: number) {
  mutations = Math.max(0, mutations + delta);
  listeners.forEach((listener) => listener());
}
export const getFacilityId = () => selected;
export const facilitySignal = () => requests.signal;
export function selectFacility(id: string) {
  requests.abort();
  requests = new AbortController();
  selected = id;
  if (id) sessionStorage.setItem("pulse.facility", id);
  else sessionStorage.removeItem("pulse.facility");
}
