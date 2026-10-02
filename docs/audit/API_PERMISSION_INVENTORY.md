# Danh mục API và quyền tại route

Snapshot 17/09/2026, trích từ 14 module routes; 66 endpoints nghiệp vụ. Không gồm health/docs. `AUTHENTICATED` chỉ chứng minh có xác thực; quyền trên từng bản ghi còn tùy controller/service, xem [báo cáo](BUSINESS_RULE_AUDIT.vi.md). Đây là hiện trạng, không phải ma trận quyền đề xuất.

| Method | Endpoint | Role guard | Validation middleware | Nguồn |
|---|---|---|---|---|
| POST | /api/v1/auth/register | PUBLIC | RegisterSchema | [auth.routes.ts:42](../../BE/src/modules/auth/auth.routes.ts) |
| POST | /api/v1/auth/login | PUBLIC | LoginSchema | [auth.routes.ts:67](../../BE/src/modules/auth/auth.routes.ts) |
| POST | /api/v1/auth/logout | AUTHENTICATED | — | [auth.routes.ts:91](../../BE/src/modules/auth/auth.routes.ts) |
| POST | /api/v1/auth/refresh-token | PUBLIC | RefreshTokenSchema | [auth.routes.ts:115](../../BE/src/modules/auth/auth.routes.ts) |
| GET | /api/v1/auth/me | AUTHENTICATED | — | [auth.routes.ts:129](../../BE/src/modules/auth/auth.routes.ts) |
| PATCH | /api/v1/auth/me | AUTHENTICATED | UpdateProfileSchema | [auth.routes.ts:158](../../BE/src/modules/auth/auth.routes.ts) |
| PATCH | /api/v1/auth/me/change-password | AUTHENTICATED | ChangePasswordSchema | [auth.routes.ts:183](../../BE/src/modules/auth/auth.routes.ts) |
| GET | /api/v1/class-schedules | AUTHENTICATED | ScheduleQuerySchema, query | [class-schedules.routes.ts:77](../../BE/src/modules/class-schedules/class-schedules.routes.ts) |
| GET | /api/v1/class-schedules/:id | AUTHENTICATED | — | [class-schedules.routes.ts:103](../../BE/src/modules/class-schedules/class-schedules.routes.ts) |
| POST | /api/v1/class-schedules | MANAGER | CreateScheduleSchema | [class-schedules.routes.ts:144](../../BE/src/modules/class-schedules/class-schedules.routes.ts) |
| PATCH | /api/v1/class-schedules/:id | MANAGER | UpdateScheduleSchema | [class-schedules.routes.ts:192](../../BE/src/modules/class-schedules/class-schedules.routes.ts) |
| DELETE | /api/v1/class-schedules/:id | MANAGER | — | [class-schedules.routes.ts:220](../../BE/src/modules/class-schedules/class-schedules.routes.ts) |
| GET | /api/v1/classes | AUTHENTICATED | ClassQuerySchema, query | [classes.routes.ts:71](../../BE/src/modules/classes/classes.routes.ts) |
| GET | /api/v1/classes/:id | AUTHENTICATED | — | [classes.routes.ts:97](../../BE/src/modules/classes/classes.routes.ts) |
| POST | /api/v1/classes | MANAGER | CreateClassSchema | [classes.routes.ts:138](../../BE/src/modules/classes/classes.routes.ts) |
| PATCH | /api/v1/classes/:id | MANAGER | UpdateClassSchema | [classes.routes.ts:186](../../BE/src/modules/classes/classes.routes.ts) |
| DELETE | /api/v1/classes/:id | MANAGER | — | [classes.routes.ts:214](../../BE/src/modules/classes/classes.routes.ts) |
| POST | /api/v1/classes/:id/coaches | MANAGER | AssignCoachSchema | [classes.routes.ts:258](../../BE/src/modules/classes/classes.routes.ts) |
| DELETE | /api/v1/classes/:id/coaches/:coachId | MANAGER | — | [classes.routes.ts:293](../../BE/src/modules/classes/classes.routes.ts) |
| GET | /api/v1/coaches | MANAGER,STAFF | CoachQuerySchema, query | [coaches.routes.ts:53](../../BE/src/modules/coaches/coaches.routes.ts) |
| GET | /api/v1/coaches/:id | AUTHENTICATED | — | [coaches.routes.ts:83](../../BE/src/modules/coaches/coaches.routes.ts) |
| PATCH | /api/v1/coaches/:id | MANAGER | UpdateCoachSchema | [coaches.routes.ts:130](../../BE/src/modules/coaches/coaches.routes.ts) |
| POST | /api/v1/enrollments | AUTHENTICATED | CreateEnrollmentSchema | [enrollments.routes.ts:35](../../BE/src/modules/enrollments/enrollments.routes.ts) |
| GET | /api/v1/enrollments/my | MEMBER | EnrollmentQuerySchema, query | [enrollments.routes.ts:59](../../BE/src/modules/enrollments/enrollments.routes.ts) |
| GET | /api/v1/enrollments/schedule/:scheduleId | MANAGER,COACH,STAFF | EnrollmentQuerySchema, query | [enrollments.routes.ts:84](../../BE/src/modules/enrollments/enrollments.routes.ts) |
| DELETE | /api/v1/enrollments/:id | AUTHENTICATED | — | [enrollments.routes.ts:110](../../BE/src/modules/enrollments/enrollments.routes.ts) |
| GET | /api/v1/invoices | MANAGER,STAFF | InvoiceQuerySchema, query | [invoices.routes.ts:36](../../BE/src/modules/invoices/invoices.routes.ts) |
| GET | /api/v1/invoices/member/:memberId | MANAGER,STAFF | — | [invoices.routes.ts:62](../../BE/src/modules/invoices/invoices.routes.ts) |
| GET | /api/v1/invoices/:id | MANAGER,STAFF | — | [invoices.routes.ts:87](../../BE/src/modules/invoices/invoices.routes.ts) |
| GET | /api/v1/members | MANAGER,STAFF | MemberQuerySchema, query | [members.routes.ts:36](../../BE/src/modules/members/members.routes.ts) |
| GET | /api/v1/members/:id | MANAGER,STAFF,COACH | — | [members.routes.ts:61](../../BE/src/modules/members/members.routes.ts) |
| PATCH | /api/v1/members/:id | MANAGER,STAFF | UpdateMemberSchema | [members.routes.ts:100](../../BE/src/modules/members/members.routes.ts) |
| GET | /api/v1/members/:id/membership-status | MANAGER,STAFF | — | [members.routes.ts:125](../../BE/src/modules/members/members.routes.ts) |
| GET | /api/v1/membership-plans | PUBLIC | PlanQuerySchema, query | [membership-plans.routes.ts:29](../../BE/src/modules/membership-plans/membership-plans.routes.ts) |
| GET | /api/v1/membership-plans/:id | PUBLIC | — | [membership-plans.routes.ts:49](../../BE/src/modules/membership-plans/membership-plans.routes.ts) |
| POST | /api/v1/membership-plans | MANAGER | CreatePlanSchema | [membership-plans.routes.ts:78](../../BE/src/modules/membership-plans/membership-plans.routes.ts) |
| PATCH | /api/v1/membership-plans/:id | MANAGER | UpdatePlanSchema | [membership-plans.routes.ts:117](../../BE/src/modules/membership-plans/membership-plans.routes.ts) |
| DELETE | /api/v1/membership-plans/:id | MANAGER | — | [membership-plans.routes.ts:143](../../BE/src/modules/membership-plans/membership-plans.routes.ts) |
| POST | /api/v1/payments | MANAGER,STAFF | CreatePaymentSchema | [payments.routes.ts:39](../../BE/src/modules/payments/payments.routes.ts) |
| GET | /api/v1/payments | MANAGER,STAFF | PaymentQuerySchema, query | [payments.routes.ts:75](../../BE/src/modules/payments/payments.routes.ts) |
| GET | /api/v1/payments/:id | MANAGER,STAFF | — | [payments.routes.ts:101](../../BE/src/modules/payments/payments.routes.ts) |
| PATCH | /api/v1/payments/:id/status | MANAGER | UpdatePaymentStatusSchema | [payments.routes.ts:135](../../BE/src/modules/payments/payments.routes.ts) |
| GET | /api/v1/reports/revenue | MANAGER | DateRangeSchema, query | [reports.routes.ts:34](../../BE/src/modules/reports/reports.routes.ts) |
| GET | /api/v1/reports/members | MANAGER | DateRangeSchema, query | [reports.routes.ts:58](../../BE/src/modules/reports/reports.routes.ts) |
| GET | /api/v1/reports/enrollments | MANAGER | DateRangeSchema, query | [reports.routes.ts:82](../../BE/src/modules/reports/reports.routes.ts) |
| GET | /api/v1/reports/memberships | MANAGER | DateRangeSchema, query | [reports.routes.ts:106](../../BE/src/modules/reports/reports.routes.ts) |
| GET | /api/v1/rooms | AUTHENTICATED | RoomQuerySchema, query | [rooms.routes.ts:50](../../BE/src/modules/rooms/rooms.routes.ts) |
| GET | /api/v1/rooms/:id | AUTHENTICATED | — | [rooms.routes.ts:76](../../BE/src/modules/rooms/rooms.routes.ts) |
| POST | /api/v1/rooms | MANAGER | CreateRoomSchema | [rooms.routes.ts:111](../../BE/src/modules/rooms/rooms.routes.ts) |
| PATCH | /api/v1/rooms/:id | MANAGER | UpdateRoomSchema | [rooms.routes.ts:154](../../BE/src/modules/rooms/rooms.routes.ts) |
| DELETE | /api/v1/rooms/:id | MANAGER | — | [rooms.routes.ts:182](../../BE/src/modules/rooms/rooms.routes.ts) |
| GET | /api/v1/sports | PUBLIC | SportQuerySchema, query | [sports.routes.ts:51](../../BE/src/modules/sports/sports.routes.ts) |
| GET | /api/v1/sports/:id | PUBLIC | — | [sports.routes.ts:72](../../BE/src/modules/sports/sports.routes.ts) |
| POST | /api/v1/sports | MANAGER | CreateSportSchema | [sports.routes.ts:103](../../BE/src/modules/sports/sports.routes.ts) |
| PATCH | /api/v1/sports/:id | MANAGER | UpdateSportSchema | [sports.routes.ts:144](../../BE/src/modules/sports/sports.routes.ts) |
| DELETE | /api/v1/sports/:id | MANAGER | — | [sports.routes.ts:172](../../BE/src/modules/sports/sports.routes.ts) |
| POST | /api/v1/subscriptions | MANAGER,STAFF | CreateSubscriptionSchema | [subscriptions.routes.ts:42](../../BE/src/modules/subscriptions/subscriptions.routes.ts) |
| POST | /api/v1/subscriptions/:id/renew | MANAGER,STAFF | RenewSubscriptionSchema | [subscriptions.routes.ts:79](../../BE/src/modules/subscriptions/subscriptions.routes.ts) |
| GET | /api/v1/subscriptions/member/:memberId | AUTHENTICATED | SubscriptionQuerySchema, query | [subscriptions.routes.ts:107](../../BE/src/modules/subscriptions/subscriptions.routes.ts) |
| GET | /api/v1/subscriptions/:id | MANAGER,STAFF | — | [subscriptions.routes.ts:133](../../BE/src/modules/subscriptions/subscriptions.routes.ts) |
| PATCH | /api/v1/subscriptions/:id/status | MANAGER | UpdateStatusSchema | [subscriptions.routes.ts:167](../../BE/src/modules/subscriptions/subscriptions.routes.ts) |
| GET | /api/v1/users | MANAGER | UserQuerySchema, query | [users.routes.ts:41](../../BE/src/modules/users/users.routes.ts) |
| POST | /api/v1/users | MANAGER | CreateUserSchema | [users.routes.ts:72](../../BE/src/modules/users/users.routes.ts) |
| GET | /api/v1/users/:id | MANAGER | — | [users.routes.ts:93](../../BE/src/modules/users/users.routes.ts) |
| PATCH | /api/v1/users/:id | MANAGER | UpdateUserSchema | [users.routes.ts:127](../../BE/src/modules/users/users.routes.ts) |
| DELETE | /api/v1/users/:id | MANAGER | — | [users.routes.ts:148](../../BE/src/modules/users/users.routes.ts) |
