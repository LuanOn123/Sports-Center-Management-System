# FE / BE API contract map — 2026-10-06

Generated from live checkout route AST and FE operations. MATCH means method/path registration matches; it does not claim every role flow or response is dynamically tested. Roles include ADMIN inheritance from authorize.ts. Service ownership and facility checks still apply. Consumers include shared dynamic resource calls and should be followed into their service modules. Full DTO/query/status metadata is in API_CONTRACT_MAP.json; backend business services are adjacent to the listed router. `/subjects` is a current BE alias of `/sports`; health/docs are infrastructure routes.

| Feature | Role / access | FE consumer | FE API | Method | Current BE route | Status |
|---|---|---|---|---|---|---|
| users | ADMIN | features/manage/config.ts<br>features/manage/ResourcePage.tsx | /users | GET | BE/src/modules/users/users.routes.ts:41 | MATCH |
| users | ADMIN | features/manage/config.ts<br>features/manage/ResourcePage.tsx | /users | POST | BE/src/modules/users/users.routes.ts:76 | MATCH |
| users | ADMIN | features/manage/ResourcePage.tsx | /users/{id} | GET | BE/src/modules/users/users.routes.ts:97 | MATCH |
| users | ADMIN | features/manage/ResourcePage.tsx | /users/{id} | PATCH | BE/src/modules/users/users.routes.ts:131 | MATCH |
| users | ADMIN | features/manage/ResourcePage.tsx | /users/{id} | DELETE | BE/src/modules/users/users.routes.ts:152 | MATCH |
| subscriptions | MANAGER, RECEPTIONIST, ADMIN | features/reception/membership/MembershipPage.tsx<br>api/membership.api.ts | /subscriptions | POST | BE/src/modules/subscriptions/subscriptions.routes.ts:43 | MATCH |
| subscriptions | MANAGER, RECEPTIONIST, ADMIN | features/reception/membership/MembershipPage.tsx<br>api/membership.api.ts | /subscriptions/{id}/renew | POST | BE/src/modules/subscriptions/subscriptions.routes.ts:80 | MATCH |
| subscriptions | Authenticated (service checks ownership) | api/membership.api.ts<br>features/reception/membership/MembershipPage.tsx<br>features/reception/payments/PaymentsPage.tsx | /subscriptions/member/{memberId} | GET | BE/src/modules/subscriptions/subscriptions.routes.ts:108 | MATCH |
| subscriptions | MANAGER, RECEPTIONIST, ADMIN | api/membership.api.ts | /subscriptions/{id} | GET | BE/src/modules/subscriptions/subscriptions.routes.ts:134 | MATCH |
| subscriptions | MANAGER, ADMIN | features/reception/membership/MembershipPage.tsx<br>shared/CancelSubscription.tsx<br>api/membership.api.ts | /subscriptions/{id}/status | PATCH | BE/src/modules/subscriptions/subscriptions.routes.ts:219 | MATCH |
| subscriptions | MEMBER | shared/CancelSubscription.tsx<br>api/membership.api.ts | /subscriptions/{id}/cancel | PATCH | BE/src/modules/subscriptions/subscriptions.routes.ts:303 | MATCH |
| sports | Public | api/classes.api.ts<br>features/manage/ActivityPlanner.tsx<br>features/manage/config.ts<br>features/operations/OperationsPage.tsx<br>shared/forms/SchemaForm.tsx | /sports | GET | BE/src/modules/sports/sports.routes.ts:57 | MATCH |
| sports | ADMIN | features/manage/ActivityPlanner.tsx<br>features/manage/config.ts<br>features/operations/OperationsPage.tsx<br>shared/forms/SchemaForm.tsx<br>api/classes.api.ts | /sports | POST | BE/src/modules/sports/sports.routes.ts:118 | MATCH |
| sports | Public | api/classes.api.ts | /sports/{id} | GET | BE/src/modules/sports/sports.routes.ts:78 | MATCH |
| sports | ADMIN | api/classes.api.ts | /sports/{id} | PATCH | BE/src/modules/sports/sports.routes.ts:166 | MATCH |
| sports | ADMIN | api/classes.api.ts | /sports/{id} | DELETE | BE/src/modules/sports/sports.routes.ts:194 | MATCH |
| rooms | Authenticated (service checks ownership) | features/manage/ActivityPlanner.tsx<br>features/manage/config.ts<br>features/manage/ResourcePage.tsx<br>features/operations/OperationsPage.tsx<br>shared/forms/SchemaForm.tsx | /rooms | GET | BE/src/modules/rooms/rooms.routes.ts:56 | MATCH |
| rooms | MANAGER, ADMIN | features/manage/config.ts<br>shared/forms/SchemaForm.tsx<br>features/manage/ResourcePage.tsx | /rooms | POST | BE/src/modules/rooms/rooms.routes.ts:122 | MATCH |
| rooms | Authenticated (service checks ownership) | features/manage/ResourcePage.tsx | /rooms/{id} | GET | BE/src/modules/rooms/rooms.routes.ts:82 | MATCH |
| rooms | MANAGER, ADMIN | features/manage/ResourcePage.tsx | /rooms/{id} | PATCH | BE/src/modules/rooms/rooms.routes.ts:169 | MATCH |
| rooms | MANAGER, ADMIN | features/manage/ResourcePage.tsx | /rooms/{id} | DELETE | BE/src/modules/rooms/rooms.routes.ts:197 | MATCH |
| rooms | MANAGER, RECEPTIONIST, ADMIN | features/manage/ResourcePage.tsx | /rooms/{roomId}/transfer-schedules/preview | POST | BE/src/modules/rooms/rooms.routes.ts:236 | MATCH |
| rooms | MANAGER, RECEPTIONIST, ADMIN | features/manage/ResourcePage.tsx | /rooms/{roomId}/transfer-schedules | POST | BE/src/modules/rooms/rooms.routes.ts:279 | MATCH |
| reports | MANAGER, ADMIN | features/manage/Dashboard.tsx | /reports/revenue | GET | BE/src/modules/reports/reports.routes.ts:34 | MATCH |
| reports | MANAGER, ADMIN | features/manage/Dashboard.tsx | /reports/members | GET | BE/src/modules/reports/reports.routes.ts:58 | MATCH |
| reports | MANAGER, ADMIN | features/manage/Dashboard.tsx | /reports/enrollments | GET | BE/src/modules/reports/reports.routes.ts:82 | MATCH |
| reports | MANAGER, ADMIN | features/manage/Dashboard.tsx | /reports/memberships | GET | BE/src/modules/reports/reports.routes.ts:106 | MATCH |
| reports | MANAGER, ADMIN | UNUSED_API (no direct consumer found) | /reports/subscription-logs | GET | BE/src/modules/reports/reports.routes.ts:197 | MATCH |
| reports | MANAGER, ADMIN | UNUSED_API (no direct consumer found) | /reports/attendance | GET | BE/src/modules/reports/reports.routes.ts:191 | MATCH |
| payments | MANAGER, RECEPTIONIST, ADMIN | features/reception/payments/PaymentsPage.tsx<br>shared/forms/SchemaForm.tsx | /payments | POST | BE/src/modules/payments/payments.routes.ts:39 | MATCH |
| payments | MANAGER, RECEPTIONIST, ADMIN | features/reception/payments/PaymentsPage.tsx | /payments | GET | BE/src/modules/payments/payments.routes.ts:75 | MATCH |
| payments | Authenticated (service checks ownership) | features/reception/payments/PaymentsPage.tsx<br>pages/member/PaymentsPage.tsx | /payments/{id} | GET | BE/src/modules/payments/payments.routes.ts:101 | MATCH |
| payments | MANAGER, ADMIN | features/reception/payments/PaymentsPage.tsx | /payments/{id}/status | PATCH | BE/src/modules/payments/payments.routes.ts:139 | MATCH |
| payments | MANAGER, ADMIN | features/reception/payments/PaymentsPage.tsx | /payments/{id}/retry-activation | POST | BE/src/modules/payments/payments.routes.ts:171 | MATCH |
| payments | MEMBER | api/sepay.api.ts<br>shared/api.ts<br>features/reception/payments/PaymentsPage.tsx | /payments/sepay/checkout | POST | BE/src/modules/payments/payments.routes.ts:267 | MATCH |
| payments | Authenticated (service checks ownership) | features/reception/payments/PaymentsPage.tsx | /payments/sepay/webhook | POST | BE/src/modules/payments/payments.routes.ts:387 | MATCH |
| payments | MEMBER, MANAGER, RECEPTIONIST, ADMIN | api/sepay.api.ts<br>shared/api.ts<br>features/reception/payments/PaymentsPage.tsx | /payments/sepay/mock-confirm | POST | BE/src/modules/payments/payments.routes.ts:443 | MATCH |
| payments | Authenticated (service checks ownership) | features/reception/payments/PaymentsPage.tsx | /payments/sepay/{id} | GET | BE/src/modules/payments/payments.routes.ts:514 | MATCH |
| notifications | Authenticated (service checks ownership) | shared/Communication.tsx | /notifications | GET | BE/src/modules/notifications/notifications.routes.ts:59 | MATCH |
| notifications | Authenticated (service checks ownership) | shared/Communication.tsx | /notifications/unread-count | GET | BE/src/modules/notifications/notifications.routes.ts:75 | MATCH |
| notifications | Authenticated (service checks ownership) | shared/Communication.tsx | /notifications/mark-all-read | PATCH | BE/src/modules/notifications/notifications.routes.ts:91 | MATCH |
| notifications | Authenticated (service checks ownership) | shared/Communication.tsx | /notifications/{id}/read | PATCH | BE/src/modules/notifications/notifications.routes.ts:116 | MATCH |
| notifications | MANAGER, RECEPTIONIST, ADMIN | shared/Communication.tsx | /notifications/trigger-upcoming-reminders | POST | BE/src/modules/notifications/notifications.routes.ts:133 | MATCH |
| membership-plans | Public | api/membership.api.ts<br>features/manage/config.ts<br>features/operations/OperationsPage.tsx<br>features/reception/membership/MembershipPage.tsx | /membership-plans | GET | BE/src/modules/membership-plans/membership-plans.routes.ts:29 | MATCH |
| membership-plans | ADMIN | features/manage/config.ts<br>api/membership.api.ts | /membership-plans | POST | BE/src/modules/membership-plans/membership-plans.routes.ts:92 | MATCH |
| membership-plans | Public | api/membership.api.ts | /membership-plans/{id} | GET | BE/src/modules/membership-plans/membership-plans.routes.ts:49 | MATCH |
| membership-plans | ADMIN | api/membership.api.ts | /membership-plans/{id} | PATCH | BE/src/modules/membership-plans/membership-plans.routes.ts:145 | MATCH |
| membership-plans | ADMIN | api/membership.api.ts | /membership-plans/{id} | DELETE | BE/src/modules/membership-plans/membership-plans.routes.ts:171 | MATCH |
| members | MANAGER, RECEPTIONIST, ADMIN | features/manage/config.ts<br>features/operations/OperationsPage.tsx<br>features/reception/components.tsx<br>features/reception/dashboard/DashboardPage.tsx<br>features/reception/members/MembersPage.tsx<br>features/reception/membership/MembershipPage.tsx | /members | GET | BE/src/modules/members/members.routes.ts:36 | MATCH |
| members | MANAGER, RECEPTIONIST, COACH, ADMIN | features/coach/CoachWorkspace.tsx<br>features/reception/members/MembersPage.tsx<br>features/reception/membership/MembershipPage.tsx | /members/{id} | GET | BE/src/modules/members/members.routes.ts:61 | MATCH |
| members | MANAGER, RECEPTIONIST, ADMIN | features/reception/members/MembersPage.tsx<br>features/reception/membership/MembershipPage.tsx | /members/{id} | PATCH | BE/src/modules/members/members.routes.ts:100 | MATCH |
| members | MANAGER, RECEPTIONIST, ADMIN | features/manage/ResourcePage.tsx<br>features/reception/membership/MembershipPage.tsx<br>features/reception/members/MembersPage.tsx | /members/{id}/membership-status | GET | BE/src/modules/members/members.routes.ts:131 | MATCH |
| invoices | MANAGER, RECEPTIONIST, ADMIN | features/reception/payments/PaymentsPage.tsx | /invoices | GET | BE/src/modules/invoices/invoices.routes.ts:36 | MATCH |
| invoices | Authenticated (service checks ownership) | features/reception/payments/PaymentsPage.tsx<br>pages/member/PaymentsPage.tsx | /invoices/member/{memberId} | GET | BE/src/modules/invoices/invoices.routes.ts:62 | MATCH |
| invoices | Authenticated (service checks ownership) | features/reception/payments/PaymentsPage.tsx | /invoices/{id} | GET | BE/src/modules/invoices/invoices.routes.ts:87 | MATCH |
| feedbacks | MEMBER | shared/CoachFeedback.tsx | /feedbacks | POST | BE/src/modules/feedbacks/feedbacks.routes.ts:90 | MATCH |
| feedbacks | Authenticated (service checks ownership) | shared/CoachFeedback.tsx | /feedbacks | GET | BE/src/modules/feedbacks/feedbacks.routes.ts:150 | MATCH |
| feedbacks | MEMBER | shared/CoachFeedback.tsx | /feedbacks/my | GET | BE/src/modules/feedbacks/feedbacks.routes.ts:178 | MATCH |
| feedbacks | MEMBER | shared/CoachFeedback.tsx | /feedbacks/{id} | DELETE | BE/src/modules/feedbacks/feedbacks.routes.ts:209 | MATCH |
| feedbacks | MANAGER, ADMIN | shared/CoachFeedback.tsx | /feedbacks/{id}/manager | DELETE | BE/src/modules/feedbacks/feedbacks.routes.ts:240 | MATCH |
| enrollments | Authenticated (service checks ownership) | api/enrollments.api.ts<br>features/reception/classes/ClassesPage.tsx | /enrollments | POST | BE/src/modules/enrollments/enrollments.routes.ts:79 | MATCH |
| enrollments | MEMBER | api/enrollments.api.ts<br>pages/member/AttendancePage.tsx | /enrollments/my | GET | BE/src/modules/enrollments/enrollments.routes.ts:103 | MATCH |
| enrollments | MEMBER | api/enrollments.api.ts | /enrollments/my/quota | GET | BE/src/modules/enrollments/enrollments.routes.ts:147 | MATCH |
| enrollments | Authenticated (service checks ownership) | api/enrollments.api.ts | /enrollments/bulk | POST | BE/src/modules/enrollments/enrollments.routes.ts:236 | MATCH |
| enrollments | MANAGER, COACH, RECEPTIONIST, ADMIN | features/coach/CoachWorkspace.tsx<br>features/manage/ResourcePage.tsx<br>features/reception/classes/ClassesPage.tsx<br>api/enrollments.api.ts | /enrollments/schedule/{scheduleId} | GET | BE/src/modules/enrollments/enrollments.routes.ts:261 | MATCH |
| enrollments | Authenticated (service checks ownership) | features/reception/classes/ClassesPage.tsx<br>api/enrollments.api.ts | /enrollments/{id} | DELETE | BE/src/modules/enrollments/enrollments.routes.ts:287 | MATCH |
| enrollments | Authenticated (service checks ownership) | api/enrollments.api.ts | /enrollments/{id}/transfer | POST | BE/src/modules/enrollments/enrollments.routes.ts:342 | MATCH |
| coaches | Authenticated (service checks ownership) | features/manage/ActivityPlanner.tsx<br>features/manage/config.ts<br>features/operations/OperationsPage.tsx<br>shared/forms/SchemaForm.tsx<br>features/manage/ResourcePage.tsx | /coaches | GET | BE/src/modules/coaches/coaches.routes.ts:53 | MATCH |
| coaches | Authenticated (service checks ownership) | features/manage/ResourcePage.tsx | /coaches/{id} | GET | BE/src/modules/coaches/coaches.routes.ts:82 | MATCH |
| coaches | MANAGER, ADMIN | features/manage/ResourcePage.tsx | /coaches/{id} | PATCH | BE/src/modules/coaches/coaches.routes.ts:129 | MATCH |
| classes | Authenticated (service checks ownership) | features/coach/data.ts<br>features/manage/config.ts<br>features/operations/OperationsPage.tsx<br>shared/forms/SchemaForm.tsx<br>api/classes.api.ts | /classes | GET | BE/src/modules/classes/classes.routes.ts:78 | MATCH |
| classes | MANAGER, RECEPTIONIST, ADMIN | features/manage/ActivityPlanner.tsx<br>features/manage/config.ts<br>shared/forms/SchemaForm.tsx<br>api/classes.api.ts | /classes | POST | BE/src/modules/classes/classes.routes.ts:193 | MATCH |
| classes | Authenticated (service checks ownership) | api/classes.api.ts | /classes/{id} | GET | BE/src/modules/classes/classes.routes.ts:104 | MATCH |
| classes | MANAGER, RECEPTIONIST, ADMIN | api/classes.api.ts | /classes/{id} | PATCH | BE/src/modules/classes/classes.routes.ts:248 | MATCH |
| classes | MANAGER, RECEPTIONIST, ADMIN | api/classes.api.ts | /classes/{id} | DELETE | BE/src/modules/classes/classes.routes.ts:276 | MATCH |
| classes | Authenticated (service checks ownership) | api/classes.api.ts | /classes/{id}/course-plan | GET | BE/src/modules/classes/classes.routes.ts:142 | MATCH |
| classes | MANAGER, RECEPTIONIST, ADMIN | features/manage/ActivityPlanner.tsx<br>features/manage/ResourcePage.tsx<br>api/classes.api.ts | /classes/{id}/coaches | POST | BE/src/modules/classes/classes.routes.ts:320 | MATCH |
| classes | MANAGER, RECEPTIONIST, ADMIN | features/manage/ActivityPlanner.tsx<br>features/manage/ResourcePage.tsx<br>api/classes.api.ts | /classes/{id}/coaches/support | POST | BE/src/modules/classes/classes.routes.ts:367 | MATCH |
| classes | MANAGER, RECEPTIONIST, ADMIN | features/manage/ResourcePage.tsx<br>api/classes.api.ts | /classes/{id}/coaches/{coachId} | DELETE | BE/src/modules/classes/classes.routes.ts:402 | MATCH |
| class-schedules | MANAGER, RECEPTIONIST, ADMIN | api/classes.api.ts | /class-schedules/activity-plan | POST | BE/src/modules/class-schedules/class-schedules.routes.ts:35 | MATCH |
| class-schedules | Authenticated (service checks ownership) | api/classes.api.ts<br>features/coach/data.ts<br>features/manage/config.ts<br>features/manage/Dashboard.tsx<br>features/reception/classes/ClassesPage.tsx<br>features/reception/dashboard/DashboardPage.tsx | /class-schedules | GET | BE/src/modules/class-schedules/class-schedules.routes.ts:135 | MATCH |
| class-schedules | MANAGER, RECEPTIONIST, ADMIN | features/manage/ActivityPlanner.tsx<br>features/manage/config.ts<br>api/classes.api.ts | /class-schedules | POST | BE/src/modules/class-schedules/class-schedules.routes.ts:208 | MATCH |
| class-schedules | Authenticated (service checks ownership) | api/classes.api.ts | /class-schedules/{id} | GET | BE/src/modules/class-schedules/class-schedules.routes.ts:161 | MATCH |
| class-schedules | MANAGER, RECEPTIONIST, ADMIN | features/manage/ResourcePage.tsx<br>shared/forms/SchemaForm.tsx<br>api/classes.api.ts | /class-schedules/{id} | PATCH | BE/src/modules/class-schedules/class-schedules.routes.ts:261 | MATCH |
| class-schedules | MANAGER, RECEPTIONIST, ADMIN | api/classes.api.ts | /class-schedules/{id} | DELETE | BE/src/modules/class-schedules/class-schedules.routes.ts:291 | MATCH |
| class-schedules | MANAGER, RECEPTIONIST, ADMIN | features/manage/ResourcePage.tsx<br>api/classes.api.ts | /class-schedules/{id}/complete | PATCH | BE/src/modules/class-schedules/class-schedules.routes.ts:318 | MATCH |
| chat | Authenticated (service checks ownership) | shared/Communication.tsx | /chat/contacts | GET | BE/src/modules/chat/chat.routes.ts:30 | MATCH |
| chat | Authenticated (service checks ownership) | shared/Communication.tsx | /chat/conversations | GET | BE/src/modules/chat/chat.routes.ts:45 | MATCH |
| chat | Authenticated (service checks ownership) | shared/Communication.tsx | /chat/messages | GET | BE/src/modules/chat/chat.routes.ts:66 | MATCH |
| chat | Authenticated (service checks ownership) | shared/Communication.tsx | /chat/messages | POST | BE/src/modules/chat/chat.routes.ts:98 | MATCH |
| chat | Authenticated (service checks ownership) | UNUSED_API (no direct consumer found) | /chat/attachments/{id} | GET | BE/src/modules/chat/chat.routes.ts:125 | MATCH |
| chat | Authenticated (service checks ownership) | shared/Communication.tsx | /chat/messages/read | PATCH | BE/src/modules/chat/chat.routes.ts:150 | MATCH |
| chat | Authenticated (service checks ownership) | shared/Communication.tsx | /chat/messages/unread-count | GET | BE/src/modules/chat/chat.routes.ts:165 | MATCH |
| auth | Public | api/auth.api.ts<br>features/auth/Register.tsx<br>features/manage/ResourcePage.tsx<br>features/reception/members/MembersPage.tsx | /auth/register | POST | BE/src/modules/auth/auth.routes.ts:50 | MATCH |
| auth | Public | api/auth.api.ts<br>shared/api.ts | /auth/login | POST | BE/src/modules/auth/auth.routes.ts:75 | MATCH |
| auth | Authenticated (service checks ownership) | api/auth.api.ts<br>shared/api.ts | /auth/logout | POST | BE/src/modules/auth/auth.routes.ts:99 | MATCH |
| auth | Public | shared/api.ts | /auth/refresh-token | POST | BE/src/modules/auth/auth.routes.ts:123 | MATCH |
| auth | Authenticated (service checks ownership) | api/auth.api.ts<br>shared/api.ts | /auth/me | GET | BE/src/modules/auth/auth.routes.ts:137 | MATCH |
| auth | Authenticated (service checks ownership) | api/auth.api.ts<br>features/coach/CoachProfile.tsx<br>shared/Profile.tsx | /auth/me | PATCH | BE/src/modules/auth/auth.routes.ts:166 | MATCH |
| auth | Authenticated (service checks ownership) | UNUSED_API (no direct consumer found) | /auth/me/avatar | POST | BE/src/modules/auth/auth.routes.ts:201 | MATCH |
| auth | Authenticated (service checks ownership) | api/auth.api.ts<br>features/coach/CoachProfile.tsx<br>shared/api.ts<br>shared/Profile.tsx | /auth/me/change-password | PATCH | BE/src/modules/auth/auth.routes.ts:226 | MATCH |
| auth | Public | shared/api.ts | /auth/forgot-password | POST | BE/src/modules/auth/auth.routes.ts:257 | MATCH |
| auth | Public | shared/api.ts | /auth/reset-password | POST | BE/src/modules/auth/auth.routes.ts:285 | MATCH |
| attendance | MEMBER, COACH, MANAGER, RECEPTIONIST, ADMIN | pages/member/AttendancePage.tsx<br>shared/Attendance.tsx | /attendance | GET | BE/src/modules/attendance/attendance.routes.ts:54 | MATCH |
| attendance | COACH, MANAGER, ADMIN | shared/Attendance.tsx | /attendance | POST | BE/src/modules/attendance/attendance.routes.ts:86 | MATCH |
| attendance | ADMIN, MANAGER | shared/Attendance.tsx | /attendance/{id} | PATCH | BE/src/modules/attendance/attendance.routes.ts:115 | MATCH |
| attendance | COACH, MANAGER, ADMIN | shared/QrAttendance.tsx | /attendance/generate-qr | POST | BE/src/modules/attendance/attendance.routes.ts:166 | MATCH |
| attendance | MEMBER | shared/QrAttendance.tsx | /attendance/scan-qr | POST | BE/src/modules/attendance/attendance.routes.ts:254 | MATCH |
| attendance | MEMBER | pages/member/AttendancePage.tsx | /attendance/my | GET | BE/src/modules/attendance/attendance.routes.ts:302 | MATCH |
| attendance | MEMBER | pages/member/AttendancePage.tsx | /attendance/my/summary | GET | BE/src/modules/attendance/attendance.routes.ts:362 | MATCH |
| attendance | MANAGER, ADMIN | features/manage/AttendancePenalties.tsx | /attendance/warnings/scan | POST | BE/src/modules/attendance/attendance.routes.ts:390 | MATCH |
| attendance | MANAGER, ADMIN | features/manage/AttendancePenalties.tsx | /attendance/penalties | GET | BE/src/modules/attendance/attendance.routes.ts:422 | MATCH |
| attendance | MANAGER, ADMIN | features/manage/AttendancePenalties.tsx | /attendance/penalties/preview | POST | BE/src/modules/attendance/attendance.routes.ts:463 | MATCH |
| attendance | MANAGER, ADMIN | features/manage/AttendancePenalties.tsx | /attendance/penalties/apply | POST | BE/src/modules/attendance/attendance.routes.ts:501 | MATCH |
| attendance | MEMBER | pages/member/AttendancePage.tsx | /attendance/penalties/{id}/appeal | POST | BE/src/modules/attendance/attendance.routes.ts:540 | MATCH |
| attendance | MANAGER, ADMIN | features/manage/AttendancePenalties.tsx | /attendance/penalties/{id}/revoke | POST | BE/src/modules/attendance/attendance.routes.ts:581 | MATCH |
| ai | Authenticated (service checks ownership) | features/ai/api.ts<br>shared/api.ts | /ai/chat | POST | BE/src/modules/ai/ai.routes.ts:54 | MATCH |
| staff-candidates | ADMIN, MANAGER | features/operations/OperationsPage.tsx | /staff-candidates | GET | BE/src/modules/operations/operations.routes.ts:45 | MATCH |
| coaches | Authenticated (service checks ownership) | features/operations/OperationsPage.tsx<br>features/manage/ResourcePage.tsx | /coaches/{id}/specializations | GET | BE/src/modules/operations/operations.routes.ts:60 | MATCH |
| coaches | ADMIN | features/operations/OperationsPage.tsx<br>features/manage/ResourcePage.tsx | /coaches/{id}/specializations | PUT | BE/src/modules/operations/operations.routes.ts:152 | MATCH |
| leave-requests | ADMIN, MANAGER | features/operations/OperationsPage.tsx | /leave-requests/{id}/affected | GET | BE/src/modules/operations/operations.routes.ts:63 | MATCH |
| facilities | Authenticated (service checks ownership) | features/operations/OperationsPage.tsx<br>shared/api.ts<br>shared/FacilityBoundary.tsx | /facilities | GET | BE/src/modules/facilities/facilities.route.ts:12 | MATCH |
| facilities | ADMIN | features/operations/OperationsPage.tsx<br>shared/api.ts<br>shared/FacilityBoundary.tsx | /facilities | POST | BE/src/modules/facilities/facilities.route.ts:23 | MATCH |
| facilities | Authenticated (service checks ownership) | features/operations/OperationsPage.tsx | /facilities/{facilityId} | GET | BE/src/modules/facilities/facilities.route.ts:15 | MATCH |
| facilities | ADMIN | features/operations/OperationsPage.tsx | /facilities/{facilityId} | PUT | BE/src/modules/facilities/facilities.route.ts:32 | MATCH |
| facilities | ADMIN, MANAGER | features/operations/OperationsPage.tsx | /facilities/{facilityId}/staff | POST | BE/src/modules/facilities/facilities.route.ts:42 | MATCH |
| facilities | ADMIN, MANAGER | features/operations/OperationsPage.tsx | /facilities/{facilityId}/staff/{userId}/{role} | DELETE | BE/src/modules/facilities/facilities.route.ts:52 | MATCH |
| rooms | ADMIN, MANAGER | features/operations/OperationsPage.tsx<br>features/manage/ResourcePage.tsx | /rooms/{id}/capabilities | PUT | BE/src/modules/operations/operations.routes.ts:92 | MATCH |
| subjects | ADMIN | features/operations/OperationsPage.tsx | /subjects/{id}/requirements | PUT | BE/src/modules/operations/operations.routes.ts:130 | MATCH |
| slots | ADMIN, MANAGER | features/operations/OperationsPage.tsx | /slots | GET | BE/src/modules/operations/operations.routes.ts:207 | MATCH |
| slots | ADMIN, MANAGER | features/operations/OperationsPage.tsx | /slots | POST | BE/src/modules/operations/operations.routes.ts:210 | MATCH |
| schedule-patterns | ADMIN, MANAGER | features/operations/OperationsPage.tsx | /schedule-patterns | GET | BE/src/modules/operations/operations.routes.ts:213 | MATCH |
| schedule-patterns | ADMIN, MANAGER | features/operations/OperationsPage.tsx | /schedule-patterns | POST | BE/src/modules/operations/operations.routes.ts:216 | MATCH |
| leave-requests | ADMIN, MANAGER, COACH | features/operations/OperationsPage.tsx | /leave-requests | GET | BE/src/modules/operations/operations.routes.ts:287 | MATCH |
| leave-requests | COACH | features/operations/OperationsPage.tsx | /leave-requests | POST | BE/src/modules/operations/operations.routes.ts:306 | MATCH |
| leave-requests | ADMIN, MANAGER | features/operations/OperationsPage.tsx | /leave-requests/{id} | PATCH | BE/src/modules/operations/operations.routes.ts:342 | MATCH |
| issues | MEMBER, MANAGER, RECEPTIONIST, ADMIN | features/operations/OperationsPage.tsx | /issues | GET | BE/src/modules/operations/operations.routes.ts:466 | MATCH |
| issues | MEMBER | features/operations/OperationsPage.tsx | /issues | POST | BE/src/modules/operations/operations.routes.ts:477 | MATCH |
| issues | MEMBER, MANAGER, RECEPTIONIST, ADMIN | features/operations/OperationsPage.tsx | /issues/{id} | GET | BE/src/modules/operations/operations.routes.ts:519 | MATCH |
| issues | MEMBER | features/operations/OperationsPage.tsx | /issues/{id} | PUT | BE/src/modules/operations/operations.routes.ts:534 | MATCH |
| issues | MEMBER | features/operations/OperationsPage.tsx | /issues/{id} | DELETE | BE/src/modules/operations/operations.routes.ts:554 | MATCH |
| issues | ADMIN, MANAGER, RECEPTIONIST | features/operations/OperationsPage.tsx | /issues/{id} | PATCH | BE/src/modules/operations/operations.routes.ts:494 | MATCH |
| audit-logs | ADMIN, MANAGER | features/operations/OperationsPage.tsx | /audit-logs | GET | BE/src/modules/operations/operations.routes.ts:512 | MATCH |
| counter-orders | ADMIN, MANAGER, RECEPTIONIST | features/operations/OperationsPage.tsx | /counter-orders | GET | BE/src/modules/operations/operations.routes.ts:562 | MATCH |
| counter-orders | ADMIN, MANAGER, RECEPTIONIST | features/operations/OperationsPage.tsx | /counter-orders | POST | BE/src/modules/operations/operations.routes.ts:570 | MATCH |
| counter-orders | ADMIN, MANAGER, RECEPTIONIST | features/operations/OperationsPage.tsx | /counter-orders/{id}/confirm | POST | BE/src/modules/operations/operations.routes.ts:616 | MATCH |
| subjects | Public | UNUSED_API (no direct consumer found) | /subjects | GET | BE/src/modules/sports/sports.routes.ts:57 | MATCH |
| subjects | ADMIN | UNUSED_API (no direct consumer found) | /subjects | POST | BE/src/modules/sports/sports.routes.ts:118 | MATCH |
| subjects | Public | UNUSED_API (no direct consumer found) | /subjects/{id} | GET | BE/src/modules/sports/sports.routes.ts:78 | MATCH |
| subjects | ADMIN | UNUSED_API (no direct consumer found) | /subjects/{id} | PATCH | BE/src/modules/sports/sports.routes.ts:166 | MATCH |
| subjects | ADMIN | UNUSED_API (no direct consumer found) | /subjects/{id} | DELETE | BE/src/modules/sports/sports.routes.ts:194 | MATCH |

Backend operations absent from FE catalog: none.

Request/response examples may be incomplete in Swagger. Handwritten workflow overrides retain stricter verified body constraints and extra parameters. Successful integration tests and their coverage are recorded separately in INTEGRATION_AUDIT_2026-10-06.md.
