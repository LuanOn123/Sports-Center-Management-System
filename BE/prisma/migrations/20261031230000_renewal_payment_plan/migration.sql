-- Recover the unambiguous source of historical renewal receipts without changing amounts.
UPDATE "Payment" AS p SET "planId" = s."planId"
FROM "MembershipSubscription" AS s
WHERE p."subscriptionId" = s.id AND p."planId" IS NULL;
