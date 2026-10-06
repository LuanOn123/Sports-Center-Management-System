import { AsyncLocalStorage } from "node:async_hooks";
import type { Prisma } from "@prisma/client";
export const requestContext = new AsyncLocalStorage<{
  facilityId?: string;
  actorId?: string;
  role?: string;
  reason?: string;
  transaction?: Prisma.TransactionClient;
}>();
