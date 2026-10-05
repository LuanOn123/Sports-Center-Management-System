import { expect, it } from "vitest";
import { roleHome } from "../src/app/roles";

it("routes legacy and Mongo receptionist roles to the same portal", () => {
  expect(roleHome("STAFF")).toBe("/receptionist");
  expect(roleHome("RECEPTIONIST")).toBe("/receptionist");
});

it("does not give unsupported or inherited roles a portal", () => {
  for (const role of ["UNKNOWN", "ADMIN", "toString", "__proto__"])
    expect(roleHome(role)).toBeUndefined();
});
