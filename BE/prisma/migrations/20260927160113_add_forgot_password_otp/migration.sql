-- DropForeignKey
ALTER TABLE "ChatAttachment" DROP CONSTRAINT "ChatAttachment_ownerId_fkey";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "resetPasswordOtp" TEXT,
ADD COLUMN     "resetPasswordOtpExpiresAt" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "ChatAttachment" ADD CONSTRAINT "ChatAttachment_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
