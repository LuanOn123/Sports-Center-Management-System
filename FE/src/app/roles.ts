export const roleHomes: Record<string, string> = {
  ADMIN: "/admin",
  MANAGER: "/manager",
  STAFF: "/receptionist",
  RECEPTIONIST: "/receptionist",
  COACH: "/coach",
  MEMBER: "/member",
};
export const roleHome = (role: string) =>
  Object.hasOwn(roleHomes, role) ? roleHomes[role] : undefined;
