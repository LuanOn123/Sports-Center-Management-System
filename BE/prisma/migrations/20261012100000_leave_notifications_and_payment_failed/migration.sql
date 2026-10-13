-- This migration does not run in a transaction

-- AlterEnum
-- PostgreSQL does not allow ALTER TYPE ... ADD VALUE inside a transaction block,
-- so this migration must run outside one. IF NOT EXISTS makes it safe to re-run.
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'PAYMENT_FAILED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'LEAVE_REQUEST_SUBMITTED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'LEAVE_REQUEST_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'LEAVE_REQUEST_REJECTED';
