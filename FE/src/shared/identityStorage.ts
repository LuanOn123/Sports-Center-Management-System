export const IDENTITY_STORAGE_VERSION = "mongo-identities-v1";
export const IDENTITY_STORAGE_KEY = "pulse.identity-version";

// Run before reading tokens. Each tab migrates once, including its own sessionStorage.
export function migrateIdentityStorage() {
  if (sessionStorage.getItem(IDENTITY_STORAGE_KEY) === IDENTITY_STORAGE_VERSION)
    return;
  const stores = [sessionStorage];
  if (typeof localStorage !== "undefined") stores.push(localStorage);
  for (const storage of stores) {
    const keys = new Set(["pulse.access", "pulse.refresh", "pulse.user"]);
    for (let index = 0; index < storage.length; index++) {
      const key = storage.key(index);
      if (key?.startsWith("pulse.pending-checkout.")) keys.add(key);
    }
    keys.forEach((key) => storage.removeItem(key));
  }
  sessionStorage.setItem(IDENTITY_STORAGE_KEY, IDENTITY_STORAGE_VERSION);
}
