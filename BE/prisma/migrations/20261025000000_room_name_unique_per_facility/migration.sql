-- G5: Room.name chỉ cần duy nhất trong một cơ sở.
-- Dữ liệu cũ đã unique toàn cục nên chắc chắn cũng unique theo (facilityId, name).
DROP INDEX IF EXISTS "Room_name_key";

CREATE UNIQUE INDEX "Room_facilityId_name_key" ON "Room"("facilityId", "name");
