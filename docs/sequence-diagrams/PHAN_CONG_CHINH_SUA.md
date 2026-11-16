# Phân công chỉnh sửa các file sequence .mmd

Phạm vi: 96 file sequence hiện có trong thư mục `docs/sequence-diagrams`. Mỗi người phụ trách đúng 32 file. Hai file kiến trúc trong `docs/architecture` không thuộc danh sách sequence này.

Giữ nguyên vị trí và tên file khi chỉnh sửa. Mỗi file chỉ có một người phụ trách chính.

| STT | Toàn — 32 file |  Luân— 32 file | Duy — 32 file |
|---|---|---|---|
| 1 | [AUTH-01_guest_register_otp.mmd](AUTH-01_guest_register_otp.mmd) | [MGR-01_create_class_schedule_wizard.mmd](MGR-01_create_class_schedule_wizard.mmd) | [ADM-01_create_facility.mmd](ADM-01_create_facility.mmd) |
| 2 | [AUTH-02_user_login.mmd](AUTH-02_user_login.mmd) | [MGR-02_assign_coach.mmd](MGR-02_assign_coach.mmd) | [ADM-02_update_facility.mmd](ADM-02_update_facility.mmd) |
| 3 | [AUTH-03_forgot_reset_password.mmd](AUTH-03_forgot_reset_password.mmd) | [MGR-03_manage_memberships_tuition.mmd](MGR-03_manage_memberships_tuition.mmd) | [ADM-03_assign_facility_manager.mmd](ADM-03_assign_facility_manager.mmd) |
| 4 | [AUTH-03b_consume_reset_otp.mmd](AUTH-03b_consume_reset_otp.mmd) | [MGR-04_manage_staff_roles.mmd](MGR-04_manage_staff_roles.mmd) | [ADM-04_assign_facility_staff.mmd](ADM-04_assign_facility_staff.mmd) |
| 5 | [AUTH-04_refresh_session.mmd](AUTH-04_refresh_session.mmd) | [MGR-05_revenue_report.mmd](MGR-05_revenue_report.mmd) | [ADM-05_create_facility_coach.mmd](ADM-05_create_facility_coach.mmd) |
| 6 | [AUTH-05_logout.mmd](AUTH-05_logout.mmd) | [MGR-06_audit_log.mmd](MGR-06_audit_log.mmd) | [ADM-06_manage_sports.mmd](ADM-06_manage_sports.mmd) |
| 7 | [AUTH-06_update_profile.mmd](AUTH-06_update_profile.mmd) | [MGR-07_create_term.mmd](MGR-07_create_term.mmd) | [ADM-07_facility_overview_report.mmd](ADM-07_facility_overview_report.mmd) |
| 8 | [AUTH-07_change_password.mmd](AUTH-07_change_password.mmd) | [MGR-08_update_term.mmd](MGR-08_update_term.mmd) | [ADM-08_export_report_csv.mmd](ADM-08_export_report_csv.mmd) |
| 9 | [AUTH-08_upload_avatar.mmd](AUTH-08_upload_avatar.mmd) | [MGR-09_create_room.mmd](MGR-09_create_room.mmd) | [ADM-09_create_receptionist.mmd](ADM-09_create_receptionist.mmd) |
| 10 | [EXT-02_ai_assistant.mmd](EXT-02_ai_assistant.mmd) | [MGR-10_update_room.mmd](MGR-10_update_room.mmd) | [COA-01_view_schedule_students.mmd](COA-01_view_schedule_students.mmd) |
| 11 | [MEM-01_browse_memberships.mmd](MEM-01_browse_memberships.mmd) | [MGR-11_transfer_room_schedules.mmd](MGR-11_transfer_room_schedules.mmd) | [COA-02_take_attendance.mmd](COA-02_take_attendance.mmd) |
| 12 | [MEM-02_purchase_membership.mmd](MEM-02_purchase_membership.mmd) | [MGR-12_create_class.mmd](MGR-12_create_class.mmd) | [COA-04_request_coach_change.mmd](COA-04_request_coach_change.mmd) |
| 13 | [MEM-03_cancel_membership_refund.mmd](MEM-03_cancel_membership_refund.mmd) | [MGR-13_update_class.mmd](MGR-13_update_class.mmd) | [COA-05_view_member_profile.mmd](COA-05_view_member_profile.mmd) |
| 14 | [MEM-04_search_classes.mmd](MEM-04_search_classes.mmd) | [MGR-14_create_schedule_batch.mmd](MGR-14_create_schedule_batch.mmd) | [PAY-01_sepay_webhook_settlement.mmd](PAY-01_sepay_webhook_settlement.mmd) |
| 15 | [MEM-05_book_class.mmd](MEM-05_book_class.mmd) | [MGR-15_update_cancel_schedule.mmd](MGR-15_update_cancel_schedule.mmd) | [PAY-02_poll_checkout_reconcile.mmd](PAY-02_poll_checkout_reconcile.mmd) |
| 16 | [MEM-06_view_booking_status.mmd](MEM-06_view_booking_status.mmd) | [MGR-16_complete_session.mmd](MGR-16_complete_session.mmd) | [PAY-03_retry_activation.mmd](PAY-03_retry_activation.mmd) |
| 17 | [MEM-07_qr_check_in.mmd](MEM-07_qr_check_in.mmd) | [MGR-17_decide_coach_change.mmd](MGR-17_decide_coach_change.mmd) | [PAY-04_approve_unactivated_refund.mmd](PAY-04_approve_unactivated_refund.mmd) |
| 18 | [MEM-08_notifications.mmd](MEM-08_notifications.mmd) | [MGR-18_decide_member_staff_leave.mmd](MGR-18_decide_member_staff_leave.mmd) | [REC-01_create_member.mmd](REC-01_create_member.mmd) |
| 19 | [MEM-09_chat.mmd](MEM-09_chat.mmd) | [MGR-19_apply_penalty.mmd](MGR-19_apply_penalty.mmd) | [REC-02_manage_booking_check_in.mmd](REC-02_manage_booking_check_in.mmd) |
| 20 | [MEM-09b_chat_attachment.mmd](MEM-09b_chat_attachment.mmd) | [MGR-20_revoke_penalty.mmd](MGR-20_revoke_penalty.mmd) | [REC-03_rotate_qr_session.mmd](REC-03_rotate_qr_session.mmd) |
| 21 | [MEM-10_receipts.mmd](MEM-10_receipts.mmd) | [MGR-21_review_attendance_report.mmd](MGR-21_review_attendance_report.mmd) | [REC-05_confirm_refund.mmd](REC-05_confirm_refund.mmd) |
| 22 | [MEM-11_feedback_rating.mmd](MEM-11_feedback_rating.mmd) | [MGR-22_correct_attendance.mmd](MGR-22_correct_attendance.mmd) | [REC-06_create_counter_order.mmd](REC-06_create_counter_order.mmd) |
| 23 | [MEM-12_join_waitlist.mmd](MEM-12_join_waitlist.mmd) | [MGR-23_attendance_report.mmd](MGR-23_attendance_report.mmd) | [REC-07_confirm_counter_order.mmd](REC-07_confirm_counter_order.mmd) |
| 24 | [MEM-13_cancel_waitlist.mmd](MEM-13_cancel_waitlist.mmd) | [MGR-24_cross_facility_usage.mmd](MGR-24_cross_facility_usage.mmd) | [REC-08_sell_membership.mmd](REC-08_sell_membership.mmd) |
| 25 | [MEM-14_cancel_booking.mmd](MEM-14_cancel_booking.mmd) | [OPS-01_update_room_capabilities.mmd](OPS-01_update_room_capabilities.mmd) | [REC-09_renew_membership.mmd](REC-09_renew_membership.mmd) |
| 26 | [MEM-15_transfer_booking.mmd](MEM-15_transfer_booking.mmd) | [OPS-02_update_coach_specializations.mmd](OPS-02_update_coach_specializations.mmd) | [REC-10_cancel_membership.mmd](REC-10_cancel_membership.mmd) |
| 27 | [MEM-16_request_class_leave.mmd](MEM-16_request_class_leave.mmd) | [OPS-03_create_time_slot.mmd](OPS-03_create_time_slot.mmd) | [REC-11_monitor_attendance.mmd](REC-11_monitor_attendance.mmd) |
| 28 | [MEM-17_appeal_penalty.mmd](MEM-17_appeal_penalty.mmd) | [OPS-04_create_schedule_pattern.mmd](OPS-04_create_schedule_pattern.mmd) | [REC-12_send_attendance_warning.mmd](REC-12_send_attendance_warning.mmd) |
| 29 | [MEM-18_submit_issue.mmd](MEM-18_submit_issue.mmd) | [OPS-05_resolve_support_issue.mmd](OPS-05_resolve_support_issue.mmd) | [REC-13_report_attendance_violation.mmd](REC-13_report_attendance_violation.mmd) |
| 30 | [MEM-19_edit_open_issue.mmd](MEM-19_edit_open_issue.mmd) | [OPS-06_trigger_class_reminders.mmd](OPS-06_trigger_class_reminders.mmd) | [REC-14_request_staff_leave.mmd](REC-14_request_staff_leave.mmd) |
| 31 | [MEM-20_update_health_notes.mmd](MEM-20_update_health_notes.mmd) | [OPS-07_scan_attendance_warnings.mmd](OPS-07_scan_attendance_warnings.mmd) | [SYS-02_subscription_lifecycle.mmd](SYS-02_subscription_lifecycle.mmd) |
| 32 | [SYS-04_socket_send_message.mmd](SYS-04_socket_send_message.mmd) | [SYS-01_waitlist_promotion.mmd](SYS-01_waitlist_promotion.mmd) | [SYS-03_notification_outbox.mmd](SYS-03_notification_outbox.mmd) |

## Danh sách riêng để từng người nhận việc

Toàn — 32 file

1. [AUTH-01_guest_register_otp.mmd](AUTH-01_guest_register_otp.mmd)
2. [AUTH-02_user_login.mmd](AUTH-02_user_login.mmd)
3. [AUTH-03_forgot_reset_password.mmd](AUTH-03_forgot_reset_password.mmd)
4. [AUTH-03b_consume_reset_otp.mmd](AUTH-03b_consume_reset_otp.mmd)
5. [AUTH-04_refresh_session.mmd](AUTH-04_refresh_session.mmd)
6. [AUTH-05_logout.mmd](AUTH-05_logout.mmd)
7. [AUTH-06_update_profile.mmd](AUTH-06_update_profile.mmd)
8. [AUTH-07_change_password.mmd](AUTH-07_change_password.mmd)
9. [AUTH-08_upload_avatar.mmd](AUTH-08_upload_avatar.mmd)
10. [EXT-02_ai_assistant.mmd](EXT-02_ai_assistant.mmd)
11. [MEM-01_browse_memberships.mmd](MEM-01_browse_memberships.mmd)
12. [MEM-02_purchase_membership.mmd](MEM-02_purchase_membership.mmd)
13. [MEM-03_cancel_membership_refund.mmd](MEM-03_cancel_membership_refund.mmd)
14. [MEM-04_search_classes.mmd](MEM-04_search_classes.mmd)
15. [MEM-05_book_class.mmd](MEM-05_book_class.mmd)
16. [MEM-06_view_booking_status.mmd](MEM-06_view_booking_status.mmd)
17. [MEM-07_qr_check_in.mmd](MEM-07_qr_check_in.mmd)
18. [MEM-08_notifications.mmd](MEM-08_notifications.mmd)
19. [MEM-09_chat.mmd](MEM-09_chat.mmd)
20. [MEM-09b_chat_attachment.mmd](MEM-09b_chat_attachment.mmd)
21. [MEM-10_receipts.mmd](MEM-10_receipts.mmd)
22. [MEM-11_feedback_rating.mmd](MEM-11_feedback_rating.mmd)
23. [MEM-12_join_waitlist.mmd](MEM-12_join_waitlist.mmd)
24. [MEM-13_cancel_waitlist.mmd](MEM-13_cancel_waitlist.mmd)
25. [MEM-14_cancel_booking.mmd](MEM-14_cancel_booking.mmd)
26. [MEM-15_transfer_booking.mmd](MEM-15_transfer_booking.mmd)
27. [MEM-16_request_class_leave.mmd](MEM-16_request_class_leave.mmd)
28. [MEM-17_appeal_penalty.mmd](MEM-17_appeal_penalty.mmd)
29. [MEM-18_submit_issue.mmd](MEM-18_submit_issue.mmd)
30. [MEM-19_edit_open_issue.mmd](MEM-19_edit_open_issue.mmd)
31. [MEM-20_update_health_notes.mmd](MEM-20_update_health_notes.mmd)
32. [SYS-04_socket_send_message.mmd](SYS-04_socket_send_message.mmd)

Luân — 32 file

1. [MGR-01_create_class_schedule_wizard.mmd](MGR-01_create_class_schedule_wizard.mmd)
2. [MGR-02_assign_coach.mmd](MGR-02_assign_coach.mmd)
3. [MGR-03_manage_memberships_tuition.mmd](MGR-03_manage_memberships_tuition.mmd)
4. [MGR-04_manage_staff_roles.mmd](MGR-04_manage_staff_roles.mmd)
5. [MGR-05_revenue_report.mmd](MGR-05_revenue_report.mmd)
6. [MGR-06_audit_log.mmd](MGR-06_audit_log.mmd)
7. [MGR-07_create_term.mmd](MGR-07_create_term.mmd)
8. [MGR-08_update_term.mmd](MGR-08_update_term.mmd)
9. [MGR-09_create_room.mmd](MGR-09_create_room.mmd)
10. [MGR-10_update_room.mmd](MGR-10_update_room.mmd)
11. [MGR-11_transfer_room_schedules.mmd](MGR-11_transfer_room_schedules.mmd)
12. [MGR-12_create_class.mmd](MGR-12_create_class.mmd)
13. [MGR-13_update_class.mmd](MGR-13_update_class.mmd)
14. [MGR-14_create_schedule_batch.mmd](MGR-14_create_schedule_batch.mmd)
15. [MGR-15_update_cancel_schedule.mmd](MGR-15_update_cancel_schedule.mmd)
16. [MGR-16_complete_session.mmd](MGR-16_complete_session.mmd)
17. [MGR-17_decide_coach_change.mmd](MGR-17_decide_coach_change.mmd)
18. [MGR-18_decide_member_staff_leave.mmd](MGR-18_decide_member_staff_leave.mmd)
19. [MGR-19_apply_penalty.mmd](MGR-19_apply_penalty.mmd)
20. [MGR-20_revoke_penalty.mmd](MGR-20_revoke_penalty.mmd)
21. [MGR-21_review_attendance_report.mmd](MGR-21_review_attendance_report.mmd)
22. [MGR-22_correct_attendance.mmd](MGR-22_correct_attendance.mmd)
23. [MGR-23_attendance_report.mmd](MGR-23_attendance_report.mmd)
24. [MGR-24_cross_facility_usage.mmd](MGR-24_cross_facility_usage.mmd)
25. [OPS-01_update_room_capabilities.mmd](OPS-01_update_room_capabilities.mmd)
26. [OPS-02_update_coach_specializations.mmd](OPS-02_update_coach_specializations.mmd)
27. [OPS-03_create_time_slot.mmd](OPS-03_create_time_slot.mmd)
28. [OPS-04_create_schedule_pattern.mmd](OPS-04_create_schedule_pattern.mmd)
29. [OPS-05_resolve_support_issue.mmd](OPS-05_resolve_support_issue.mmd)
30. [OPS-06_trigger_class_reminders.mmd](OPS-06_trigger_class_reminders.mmd)
31. [OPS-07_scan_attendance_warnings.mmd](OPS-07_scan_attendance_warnings.mmd)
32. [SYS-01_waitlist_promotion.mmd](SYS-01_waitlist_promotion.mmd)

Duy — 32 file

1. [ADM-01_create_facility.mmd](ADM-01_create_facility.mmd)
2. [ADM-02_update_facility.mmd](ADM-02_update_facility.mmd)
3. [ADM-03_assign_facility_manager.mmd](ADM-03_assign_facility_manager.mmd)
4. [ADM-04_assign_facility_staff.mmd](ADM-04_assign_facility_staff.mmd)
5. [ADM-05_create_facility_coach.mmd](ADM-05_create_facility_coach.mmd)
6. [ADM-06_manage_sports.mmd](ADM-06_manage_sports.mmd)
7. [ADM-07_facility_overview_report.mmd](ADM-07_facility_overview_report.mmd)
8. [ADM-08_export_report_csv.mmd](ADM-08_export_report_csv.mmd)
9. [ADM-09_create_receptionist.mmd](ADM-09_create_receptionist.mmd)
10. [COA-01_view_schedule_students.mmd](COA-01_view_schedule_students.mmd)
11. [COA-02_take_attendance.mmd](COA-02_take_attendance.mmd)
12. [COA-04_request_coach_change.mmd](COA-04_request_coach_change.mmd)
13. [COA-05_view_member_profile.mmd](COA-05_view_member_profile.mmd)
14. [PAY-01_sepay_webhook_settlement.mmd](PAY-01_sepay_webhook_settlement.mmd)
15. [PAY-02_poll_checkout_reconcile.mmd](PAY-02_poll_checkout_reconcile.mmd)
16. [PAY-03_retry_activation.mmd](PAY-03_retry_activation.mmd)
17. [PAY-04_approve_unactivated_refund.mmd](PAY-04_approve_unactivated_refund.mmd)
18. [REC-01_create_member.mmd](REC-01_create_member.mmd)
19. [REC-02_manage_booking_check_in.mmd](REC-02_manage_booking_check_in.mmd)
20. [REC-03_rotate_qr_session.mmd](REC-03_rotate_qr_session.mmd)
21. [REC-05_confirm_refund.mmd](REC-05_confirm_refund.mmd)
22. [REC-06_create_counter_order.mmd](REC-06_create_counter_order.mmd)
23. [REC-07_confirm_counter_order.mmd](REC-07_confirm_counter_order.mmd)
24. [REC-08_sell_membership.mmd](REC-08_sell_membership.mmd)
25. [REC-09_renew_membership.mmd](REC-09_renew_membership.mmd)
26. [REC-10_cancel_membership.mmd](REC-10_cancel_membership.mmd)
27. [REC-11_monitor_attendance.mmd](REC-11_monitor_attendance.mmd)
28. [REC-12_send_attendance_warning.mmd](REC-12_send_attendance_warning.mmd)
29. [REC-13_report_attendance_violation.mmd](REC-13_report_attendance_violation.mmd)
30. [REC-14_request_staff_leave.mmd](REC-14_request_staff_leave.mmd)
31. [SYS-02_subscription_lifecycle.mmd](SYS-02_subscription_lifecycle.mmd)
32. [SYS-03_notification_outbox.mmd](SYS-03_notification_outbox.mmd)

