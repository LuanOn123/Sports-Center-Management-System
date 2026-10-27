export const TERM_MEMBERSHIP_POLICY = "HALF_REMAINING_TERM_V1";

type SubscriptionPeriod = {
  id: string;
  startDate: Date;
  endDate: Date;
  status: string;
};
export type TermMembershipGrant = {
  policy: typeof TERM_MEMBERSHIP_POLICY;
  memberId: string;
  classId: string;
  termId: string;
  subscriptionId: string;
  approvedAt: string;
  subscriptionStartDate: string;
  subscriptionEndDate: string;
  validUntil: string;
};

/** Compare milliseconds without rounding: exactly 50% passes; 50% minus 1 ms fails. */
export function remainingMembershipRatio(
  sub: SubscriptionPeriod,
  now: Date,
): number {
  const start = sub.startDate.getTime(),
    end = sub.endDate.getTime(),
    at = now.getTime();
  if (
    sub.status !== "ACTIVE" ||
    !Number.isFinite(start + end + at) ||
    start > at ||
    end <= at ||
    end <= start
  )
    return 0;
  return (end - at) / (end - start);
}

export function createTermMembershipGrant(
  sub: SubscriptionPeriod,
  term: { id: string; endDate: Date },
  memberId: string,
  classId: string,
  now: Date,
): TermMembershipGrant | null {
  if (remainingMembershipRatio(sub, now) < 0.5 || !Number.isFinite(term.endDate.getTime()) || term.endDate <= now)
    return null;
  return {
    policy: TERM_MEMBERSHIP_POLICY,
    memberId,
    classId,
    termId: term.id,
    subscriptionId: sub.id,
    approvedAt: now.toISOString(),
    subscriptionStartDate: sub.startDate.toISOString(),
    subscriptionEndDate: sub.endDate.toISOString(),
    validUntil: term.endDate.toISOString(),
  };
}

/** Server-created snapshot; cannot grant another member, class or term any rights. */
export function readTermMembershipGrant(
  value: unknown,
): TermMembershipGrant | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (
    row.policy !== TERM_MEMBERSHIP_POLICY ||
    ![
      "memberId",
      "classId",
      "termId",
      "subscriptionId",
      "approvedAt",
      "subscriptionStartDate",
      "subscriptionEndDate",
      "validUntil",
    ].every((key) => typeof row[key] === "string" && row[key] !== "")
  )
    return null;
  const grant = row as TermMembershipGrant;
  const approvedAt = new Date(grant.approvedAt),
    validUntil = new Date(grant.validUntil);
  if (
    !Number.isFinite(validUntil.getTime()) ||
    validUntil < approvedAt ||
    remainingMembershipRatio(
      {
        id: grant.subscriptionId,
        status: "ACTIVE",
        startDate: new Date(grant.subscriptionStartDate),
        endDate: new Date(grant.subscriptionEndDate),
      },
      approvedAt,
    ) < 0.5
  )
    return null;
  return grant;
}

export function termMembershipCovers(
  value: unknown,
  target: {
    memberId: string;
    classId: string;
    termId?: string | null;
    startTime: Date;
    endTime: Date;
  },
) {
  const grant = readTermMembershipGrant(value);
  return (
    !!grant &&
    grant.memberId === target.memberId &&
    grant.classId === target.classId &&
    grant.termId === target.termId &&
    new Date(grant.approvedAt) <= target.startTime &&
    target.startTime < target.endTime &&
    target.endTime <= new Date(grant.validUntil)
  );
}
