/** One interpretation of primary, substitute and supporting coaches across modules. */
export function effectiveCoachIds(schedule: {
  coachId?: string | null;
  class: { coaches: { coachId: string; isPrimary?: boolean }[] };
}): string[] {
  const assignments = schedule.class.coaches;
  return [
    ...new Set([
      ...assignments
        .filter((row) => !schedule.coachId || row.isPrimary === false)
        .map((row) => row.coachId),
      ...(schedule.coachId ? [schedule.coachId] : []),
    ]),
  ];
}

export function effectiveCoachWhere(coachId: string) {
  return {
    OR: [
      { coachId },
      { coachId: null, class: { coaches: { some: { coachId } } } },
      { class: { coaches: { some: { coachId, isPrimary: false } } } },
    ],
  };
}
