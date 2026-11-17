import assert from "node:assert/strict";
import { test } from "node:test";
import type { ZodTypeAny } from "zod";

// These cases exercise production functions with explicit fixtures. Any accidental
// database access fails locally rather than using a developer's configured database.
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "postgresql://fixture:fixture@127.0.0.1:1/business_acceptance";
process.env.DIRECT_DATABASE_URL = process.env.DATABASE_URL;
process.env.MONGO_URI = "mongodb://127.0.0.1:1/business_acceptance";
process.env.JWT_ACCESS_SECRET = "business-acceptance-local-fixture-access";
process.env.JWT_REFRESH_SECRET = "business-acceptance-local-fixture-refresh";

export function cases<T extends readonly [string, ...unknown[]]>(
  group: string,
  rows: readonly T[],
  verify: (row: T) => void | Promise<void>,
) {
  for (const [index, row] of rows.entries()) {
    const id = `${group}-${String(index + 1).padStart(2, "0")}`;
    test(`${id} ${row[0]}`, () => verify(row));
  }
}

type SchemaCase = readonly [name: string, input: unknown, expected: boolean, field?: string];

export function schemaCases(
  group: string,
  schema: ZodTypeAny,
  rows: readonly SchemaCase[],
) {
  cases(group, rows, ([, input, expected, field]) => {
    const result = schema.safeParse(input);
    if (expected) {
      if (!result.success) assert.fail(result.error.message);
    } else {
      assert.equal(result.success, false, "Invalid input reached the business service");
      if (!result.success && field !== undefined)
        assert.ok(result.error.issues.some(issue => issue.path.join(".") === field), result.error.message);
    }
  });
}

export const MINUTE = 60_000;
export const DAY = 86_400_000;
export const NOW = new Date("2032-03-15T03:00:00.000Z");
export const at = (offset: number) => new Date(+NOW + offset);

export async function withFixture<T>(
  stubs: readonly [object, string, (...args: any[]) => unknown][],
  run: () => Promise<T>,
): Promise<T> {
  const restore: (() => void)[] = [];
  try {
    for (const [target, key, stub] of stubs) {
      const previous = Object.getOwnPropertyDescriptor(target, key);
      Object.defineProperty(target, key, { configurable: true, writable: true, value: stub });
      restore.push(() => {
        if (previous) Object.defineProperty(target, key, previous);
        else Reflect.deleteProperty(target, key);
      });
    }
    return await run();
  } finally {
    for (const reset of restore.reverse()) reset();
  }
}
