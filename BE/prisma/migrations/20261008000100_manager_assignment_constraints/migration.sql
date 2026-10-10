-- Fail on conflicting legacy assignments rather than silently transferring staff.
-- Resolve duplicates explicitly before deploying this migration.
CREATE UNIQUE INDEX "FacilityStaff_one_active_manager_per_facility"
ON "FacilityStaff" ("facilityId") WHERE "role" = 'MANAGER' AND "isActive" = true;

CREATE UNIQUE INDEX "FacilityStaff_one_active_facility_per_coach_manager"
ON "FacilityStaff" ("userId") WHERE "role" IN ('COACH', 'MANAGER') AND "isActive" = true;
