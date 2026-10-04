import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  IDENTITY_STORAGE_KEY,
  IDENTITY_STORAGE_VERSION,
  migrateIdentityStorage,
} from "../src/shared/identityStorage";
function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
    clear: () => values.clear(),
    key: (index) => [...values.keys()][index] ?? null,
  };
}
beforeEach(() => {
  vi.stubGlobal("sessionStorage", memoryStorage());
  vi.stubGlobal("localStorage", memoryStorage());
});
describe("Mongo identity storage migration", () => {
  it("clears legacy auth and pending checkout in both stores while preserving unrelated preferences", () => {
    for (const storage of [sessionStorage, localStorage]) {
      storage.setItem("pulse.access", "legacy");
      storage.setItem("pulse.refresh", "legacy-refresh");
      storage.setItem("pulse.user", JSON.stringify({ id: "legacy-uuid" }));
      storage.setItem("pulse.pending-checkout.old-user", "checkout");
      storage.setItem("preferred-theme", "dark");
    }
    migrateIdentityStorage();
    for (const storage of [sessionStorage, localStorage]) {
      expect(storage.getItem("pulse.access")).toBeNull();
      expect(storage.getItem("pulse.refresh")).toBeNull();
      expect(storage.getItem("pulse.user")).toBeNull();
      expect(storage.getItem("pulse.pending-checkout.old-user")).toBeNull();
      expect(storage.getItem("preferred-theme")).toBe("dark");
    }
    expect(sessionStorage.getItem(IDENTITY_STORAGE_KEY)).toBe(
      IDENTITY_STORAGE_VERSION,
    );
  });
  it("preserves new sessions on reload and migrates another tab independently", () => {
    migrateIdentityStorage();
    sessionStorage.setItem("pulse.access", "new-session");
    migrateIdentityStorage();
    expect(sessionStorage.getItem("pulse.access")).toBe("new-session");
    vi.stubGlobal("sessionStorage", memoryStorage());
    sessionStorage.setItem("pulse.access", "other-tab-legacy");
    migrateIdentityStorage();
    expect(sessionStorage.getItem("pulse.access")).toBeNull();
  });
});
