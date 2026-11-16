# Diagram inventory and files modified

Date: 1 November 2026. Original sequence work was already untracked and was preserved. [Detailed hashes and artifact inventory](inventory.json) · [Audit report](REPORT.md).

Discovered: 98 raw Mermaid files (96 sequences + 2 architecture), 8 Mermaid blocks in presentation/diagrams.md, 5 native SVGs and 7 PNG diagram renditions. No draw.io XML or PlantUML was found. The AGENTS.md example and logo/media assets are excluded.

All existing diagram sources/renditions were updated in place. Two SVGs restore editable sources for the two existing raster-only architecture variants. The 106 SVG exports are report renditions of existing Mermaid diagrams, not new business workflows.

## Existing diagram files modified

| Path | Kind |
|---|---|
| [docs/architecture/database-erd.mmd](../../docs/architecture/database-erd.mmd) | .mmd |
| [docs/architecture/sports-center-use-cases.mmd](../../docs/architecture/sports-center-use-cases.mmd) | .mmd |
| [docs/presentation/01-tech-stack.png](../../docs/presentation/01-tech-stack.png) | .png |
| [docs/presentation/01-tech-stack.svg](../../docs/presentation/01-tech-stack.svg) | .svg |
| [docs/presentation/02-system-architecture.png](../../docs/presentation/02-system-architecture.png) | .png |
| [docs/presentation/02-system-architecture.svg](../../docs/presentation/02-system-architecture.svg) | .svg |
| [docs/presentation/03-use-case-admin-manager.png](../../docs/presentation/03-use-case-admin-manager.png) | .png |
| [docs/presentation/03-use-case-admin-manager.svg](../../docs/presentation/03-use-case-admin-manager.svg) | .svg |
| [docs/presentation/04-use-case-receptionist-coach.png](../../docs/presentation/04-use-case-receptionist-coach.png) | .png |
| [docs/presentation/04-use-case-receptionist-coach.svg](../../docs/presentation/04-use-case-receptionist-coach.svg) | .svg |
| [docs/presentation/05-use-case-member-guest.png](../../docs/presentation/05-use-case-member-guest.png) | .png |
| [docs/presentation/05-use-case-member-guest.svg](../../docs/presentation/05-use-case-member-guest.svg) | .svg |
| [docs/presentation/06-web-architecture-corrected.png](../../docs/presentation/06-web-architecture-corrected.png) | .png |
| [docs/presentation/07-web-architecture-english.png](../../docs/presentation/07-web-architecture-english.png) | .png |
| [docs/presentation/diagrams.md](../../docs/presentation/diagrams.md) | 8 embedded Mermaid blocks |
| [docs/sequence-diagrams/ADM-01_create_facility.mmd](../../docs/sequence-diagrams/ADM-01_create_facility.mmd) | .mmd |
| [docs/sequence-diagrams/ADM-02_update_facility.mmd](../../docs/sequence-diagrams/ADM-02_update_facility.mmd) | .mmd |
| [docs/sequence-diagrams/ADM-03_assign_facility_manager.mmd](../../docs/sequence-diagrams/ADM-03_assign_facility_manager.mmd) | .mmd |
| [docs/sequence-diagrams/ADM-04_assign_facility_staff.mmd](../../docs/sequence-diagrams/ADM-04_assign_facility_staff.mmd) | .mmd |
| [docs/sequence-diagrams/ADM-05_create_facility_coach.mmd](../../docs/sequence-diagrams/ADM-05_create_facility_coach.mmd) | .mmd |
| [docs/sequence-diagrams/ADM-06_manage_sports.mmd](../../docs/sequence-diagrams/ADM-06_manage_sports.mmd) | .mmd |
| [docs/sequence-diagrams/ADM-07_facility_overview_report.mmd](../../docs/sequence-diagrams/ADM-07_facility_overview_report.mmd) | .mmd |
| [docs/sequence-diagrams/ADM-08_export_report_csv.mmd](../../docs/sequence-diagrams/ADM-08_export_report_csv.mmd) | .mmd |
| [docs/sequence-diagrams/ADM-09_create_receptionist.mmd](../../docs/sequence-diagrams/ADM-09_create_receptionist.mmd) | .mmd |
| [docs/sequence-diagrams/AUTH-01_guest_register_otp.mmd](../../docs/sequence-diagrams/AUTH-01_guest_register_otp.mmd) | .mmd |
| [docs/sequence-diagrams/AUTH-02_user_login.mmd](../../docs/sequence-diagrams/AUTH-02_user_login.mmd) | .mmd |
| [docs/sequence-diagrams/AUTH-03b_consume_reset_otp.mmd](../../docs/sequence-diagrams/AUTH-03b_consume_reset_otp.mmd) | .mmd |
| [docs/sequence-diagrams/AUTH-03_forgot_reset_password.mmd](../../docs/sequence-diagrams/AUTH-03_forgot_reset_password.mmd) | .mmd |
| [docs/sequence-diagrams/AUTH-04_refresh_session.mmd](../../docs/sequence-diagrams/AUTH-04_refresh_session.mmd) | .mmd |
| [docs/sequence-diagrams/AUTH-05_logout.mmd](../../docs/sequence-diagrams/AUTH-05_logout.mmd) | .mmd |
| [docs/sequence-diagrams/AUTH-06_update_profile.mmd](../../docs/sequence-diagrams/AUTH-06_update_profile.mmd) | .mmd |
| [docs/sequence-diagrams/AUTH-07_change_password.mmd](../../docs/sequence-diagrams/AUTH-07_change_password.mmd) | .mmd |
| [docs/sequence-diagrams/AUTH-08_upload_avatar.mmd](../../docs/sequence-diagrams/AUTH-08_upload_avatar.mmd) | .mmd |
| [docs/sequence-diagrams/COA-01_view_schedule_students.mmd](../../docs/sequence-diagrams/COA-01_view_schedule_students.mmd) | .mmd |
| [docs/sequence-diagrams/COA-02_take_attendance.mmd](../../docs/sequence-diagrams/COA-02_take_attendance.mmd) | .mmd |
| [docs/sequence-diagrams/COA-04_request_coach_change.mmd](../../docs/sequence-diagrams/COA-04_request_coach_change.mmd) | .mmd |
| [docs/sequence-diagrams/COA-05_view_member_profile.mmd](../../docs/sequence-diagrams/COA-05_view_member_profile.mmd) | .mmd |
| [docs/sequence-diagrams/EXT-02_ai_assistant.mmd](../../docs/sequence-diagrams/EXT-02_ai_assistant.mmd) | .mmd |
| [docs/sequence-diagrams/MEM-01_browse_memberships.mmd](../../docs/sequence-diagrams/MEM-01_browse_memberships.mmd) | .mmd |
| [docs/sequence-diagrams/MEM-02_purchase_membership.mmd](../../docs/sequence-diagrams/MEM-02_purchase_membership.mmd) | .mmd |
| [docs/sequence-diagrams/MEM-03_cancel_membership_refund.mmd](../../docs/sequence-diagrams/MEM-03_cancel_membership_refund.mmd) | .mmd |
| [docs/sequence-diagrams/MEM-04_search_classes.mmd](../../docs/sequence-diagrams/MEM-04_search_classes.mmd) | .mmd |
| [docs/sequence-diagrams/MEM-05_book_class.mmd](../../docs/sequence-diagrams/MEM-05_book_class.mmd) | .mmd |
| [docs/sequence-diagrams/MEM-06_view_booking_status.mmd](../../docs/sequence-diagrams/MEM-06_view_booking_status.mmd) | .mmd |
| [docs/sequence-diagrams/MEM-07_qr_check_in.mmd](../../docs/sequence-diagrams/MEM-07_qr_check_in.mmd) | .mmd |
| [docs/sequence-diagrams/MEM-08_notifications.mmd](../../docs/sequence-diagrams/MEM-08_notifications.mmd) | .mmd |
| [docs/sequence-diagrams/MEM-09b_chat_attachment.mmd](../../docs/sequence-diagrams/MEM-09b_chat_attachment.mmd) | .mmd |
| [docs/sequence-diagrams/MEM-09_chat.mmd](../../docs/sequence-diagrams/MEM-09_chat.mmd) | .mmd |
| [docs/sequence-diagrams/MEM-10_receipts.mmd](../../docs/sequence-diagrams/MEM-10_receipts.mmd) | .mmd |
| [docs/sequence-diagrams/MEM-11_feedback_rating.mmd](../../docs/sequence-diagrams/MEM-11_feedback_rating.mmd) | .mmd |
| [docs/sequence-diagrams/MEM-12_join_waitlist.mmd](../../docs/sequence-diagrams/MEM-12_join_waitlist.mmd) | .mmd |
| [docs/sequence-diagrams/MEM-13_cancel_waitlist.mmd](../../docs/sequence-diagrams/MEM-13_cancel_waitlist.mmd) | .mmd |
| [docs/sequence-diagrams/MEM-14_cancel_booking.mmd](../../docs/sequence-diagrams/MEM-14_cancel_booking.mmd) | .mmd |
| [docs/sequence-diagrams/MEM-15_transfer_booking.mmd](../../docs/sequence-diagrams/MEM-15_transfer_booking.mmd) | .mmd |
| [docs/sequence-diagrams/MEM-16_request_class_leave.mmd](../../docs/sequence-diagrams/MEM-16_request_class_leave.mmd) | .mmd |
| [docs/sequence-diagrams/MEM-17_appeal_penalty.mmd](../../docs/sequence-diagrams/MEM-17_appeal_penalty.mmd) | .mmd |
| [docs/sequence-diagrams/MEM-18_submit_issue.mmd](../../docs/sequence-diagrams/MEM-18_submit_issue.mmd) | .mmd |
| [docs/sequence-diagrams/MEM-19_edit_open_issue.mmd](../../docs/sequence-diagrams/MEM-19_edit_open_issue.mmd) | .mmd |
| [docs/sequence-diagrams/MEM-20_update_health_notes.mmd](../../docs/sequence-diagrams/MEM-20_update_health_notes.mmd) | .mmd |
| [docs/sequence-diagrams/MGR-01_create_class_schedule_wizard.mmd](../../docs/sequence-diagrams/MGR-01_create_class_schedule_wizard.mmd) | .mmd |
| [docs/sequence-diagrams/MGR-02_assign_coach.mmd](../../docs/sequence-diagrams/MGR-02_assign_coach.mmd) | .mmd |
| [docs/sequence-diagrams/MGR-03_manage_memberships_tuition.mmd](../../docs/sequence-diagrams/MGR-03_manage_memberships_tuition.mmd) | .mmd |
| [docs/sequence-diagrams/MGR-04_manage_staff_roles.mmd](../../docs/sequence-diagrams/MGR-04_manage_staff_roles.mmd) | .mmd |
| [docs/sequence-diagrams/MGR-05_revenue_report.mmd](../../docs/sequence-diagrams/MGR-05_revenue_report.mmd) | .mmd |
| [docs/sequence-diagrams/MGR-06_audit_log.mmd](../../docs/sequence-diagrams/MGR-06_audit_log.mmd) | .mmd |
| [docs/sequence-diagrams/MGR-07_create_term.mmd](../../docs/sequence-diagrams/MGR-07_create_term.mmd) | .mmd |
| [docs/sequence-diagrams/MGR-08_update_term.mmd](../../docs/sequence-diagrams/MGR-08_update_term.mmd) | .mmd |
| [docs/sequence-diagrams/MGR-09_create_room.mmd](../../docs/sequence-diagrams/MGR-09_create_room.mmd) | .mmd |
| [docs/sequence-diagrams/MGR-10_update_room.mmd](../../docs/sequence-diagrams/MGR-10_update_room.mmd) | .mmd |
| [docs/sequence-diagrams/MGR-11_transfer_room_schedules.mmd](../../docs/sequence-diagrams/MGR-11_transfer_room_schedules.mmd) | .mmd |
| [docs/sequence-diagrams/MGR-12_create_class.mmd](../../docs/sequence-diagrams/MGR-12_create_class.mmd) | .mmd |
| [docs/sequence-diagrams/MGR-13_update_class.mmd](../../docs/sequence-diagrams/MGR-13_update_class.mmd) | .mmd |
| [docs/sequence-diagrams/MGR-14_create_schedule_batch.mmd](../../docs/sequence-diagrams/MGR-14_create_schedule_batch.mmd) | .mmd |
| [docs/sequence-diagrams/MGR-15_update_cancel_schedule.mmd](../../docs/sequence-diagrams/MGR-15_update_cancel_schedule.mmd) | .mmd |
| [docs/sequence-diagrams/MGR-16_complete_session.mmd](../../docs/sequence-diagrams/MGR-16_complete_session.mmd) | .mmd |
| [docs/sequence-diagrams/MGR-17_decide_coach_change.mmd](../../docs/sequence-diagrams/MGR-17_decide_coach_change.mmd) | .mmd |
| [docs/sequence-diagrams/MGR-18_decide_member_staff_leave.mmd](../../docs/sequence-diagrams/MGR-18_decide_member_staff_leave.mmd) | .mmd |
| [docs/sequence-diagrams/MGR-19_apply_penalty.mmd](../../docs/sequence-diagrams/MGR-19_apply_penalty.mmd) | .mmd |
| [docs/sequence-diagrams/MGR-20_revoke_penalty.mmd](../../docs/sequence-diagrams/MGR-20_revoke_penalty.mmd) | .mmd |
| [docs/sequence-diagrams/MGR-21_review_attendance_report.mmd](../../docs/sequence-diagrams/MGR-21_review_attendance_report.mmd) | .mmd |
| [docs/sequence-diagrams/MGR-22_correct_attendance.mmd](../../docs/sequence-diagrams/MGR-22_correct_attendance.mmd) | .mmd |
| [docs/sequence-diagrams/MGR-23_attendance_report.mmd](../../docs/sequence-diagrams/MGR-23_attendance_report.mmd) | .mmd |
| [docs/sequence-diagrams/MGR-24_cross_facility_usage.mmd](../../docs/sequence-diagrams/MGR-24_cross_facility_usage.mmd) | .mmd |
| [docs/sequence-diagrams/OPS-01_update_room_capabilities.mmd](../../docs/sequence-diagrams/OPS-01_update_room_capabilities.mmd) | .mmd |
| [docs/sequence-diagrams/OPS-02_update_coach_specializations.mmd](../../docs/sequence-diagrams/OPS-02_update_coach_specializations.mmd) | .mmd |
| [docs/sequence-diagrams/OPS-03_create_time_slot.mmd](../../docs/sequence-diagrams/OPS-03_create_time_slot.mmd) | .mmd |
| [docs/sequence-diagrams/OPS-04_create_schedule_pattern.mmd](../../docs/sequence-diagrams/OPS-04_create_schedule_pattern.mmd) | .mmd |
| [docs/sequence-diagrams/OPS-05_resolve_support_issue.mmd](../../docs/sequence-diagrams/OPS-05_resolve_support_issue.mmd) | .mmd |
| [docs/sequence-diagrams/OPS-06_trigger_class_reminders.mmd](../../docs/sequence-diagrams/OPS-06_trigger_class_reminders.mmd) | .mmd |
| [docs/sequence-diagrams/OPS-07_scan_attendance_warnings.mmd](../../docs/sequence-diagrams/OPS-07_scan_attendance_warnings.mmd) | .mmd |
| [docs/sequence-diagrams/PAY-01_sepay_webhook_settlement.mmd](../../docs/sequence-diagrams/PAY-01_sepay_webhook_settlement.mmd) | .mmd |
| [docs/sequence-diagrams/PAY-02_poll_checkout_reconcile.mmd](../../docs/sequence-diagrams/PAY-02_poll_checkout_reconcile.mmd) | .mmd |
| [docs/sequence-diagrams/PAY-03_retry_activation.mmd](../../docs/sequence-diagrams/PAY-03_retry_activation.mmd) | .mmd |
| [docs/sequence-diagrams/PAY-04_approve_unactivated_refund.mmd](../../docs/sequence-diagrams/PAY-04_approve_unactivated_refund.mmd) | .mmd |
| [docs/sequence-diagrams/REC-01_create_member.mmd](../../docs/sequence-diagrams/REC-01_create_member.mmd) | .mmd |
| [docs/sequence-diagrams/REC-02_manage_booking_check_in.mmd](../../docs/sequence-diagrams/REC-02_manage_booking_check_in.mmd) | .mmd |
| [docs/sequence-diagrams/REC-03_rotate_qr_session.mmd](../../docs/sequence-diagrams/REC-03_rotate_qr_session.mmd) | .mmd |
| [docs/sequence-diagrams/REC-05_confirm_refund.mmd](../../docs/sequence-diagrams/REC-05_confirm_refund.mmd) | .mmd |
| [docs/sequence-diagrams/REC-06_create_counter_order.mmd](../../docs/sequence-diagrams/REC-06_create_counter_order.mmd) | .mmd |
| [docs/sequence-diagrams/REC-07_confirm_counter_order.mmd](../../docs/sequence-diagrams/REC-07_confirm_counter_order.mmd) | .mmd |
| [docs/sequence-diagrams/REC-08_sell_membership.mmd](../../docs/sequence-diagrams/REC-08_sell_membership.mmd) | .mmd |
| [docs/sequence-diagrams/REC-09_renew_membership.mmd](../../docs/sequence-diagrams/REC-09_renew_membership.mmd) | .mmd |
| [docs/sequence-diagrams/REC-10_cancel_membership.mmd](../../docs/sequence-diagrams/REC-10_cancel_membership.mmd) | .mmd |
| [docs/sequence-diagrams/REC-11_monitor_attendance.mmd](../../docs/sequence-diagrams/REC-11_monitor_attendance.mmd) | .mmd |
| [docs/sequence-diagrams/REC-12_send_attendance_warning.mmd](../../docs/sequence-diagrams/REC-12_send_attendance_warning.mmd) | .mmd |
| [docs/sequence-diagrams/REC-13_report_attendance_violation.mmd](../../docs/sequence-diagrams/REC-13_report_attendance_violation.mmd) | .mmd |
| [docs/sequence-diagrams/REC-14_request_staff_leave.mmd](../../docs/sequence-diagrams/REC-14_request_staff_leave.mmd) | .mmd |
| [docs/sequence-diagrams/SYS-01_waitlist_promotion.mmd](../../docs/sequence-diagrams/SYS-01_waitlist_promotion.mmd) | .mmd |
| [docs/sequence-diagrams/SYS-02_subscription_lifecycle.mmd](../../docs/sequence-diagrams/SYS-02_subscription_lifecycle.mmd) | .mmd |
| [docs/sequence-diagrams/SYS-03_notification_outbox.mmd](../../docs/sequence-diagrams/SYS-03_notification_outbox.mmd) | .mmd |
| [docs/sequence-diagrams/SYS-04_socket_send_message.mmd](../../docs/sequence-diagrams/SYS-04_socket_send_message.mmd) | .mmd |

## New editable sources for existing raster diagrams

| Path | Existing raster counterpart |
|---|---|
| [docs/presentation/06-web-architecture-corrected.svg](../../docs/presentation/06-web-architecture-corrected.svg) | docs/presentation/06-web-architecture-corrected.png |
| [docs/presentation/07-web-architecture-english.svg](../../docs/presentation/07-web-architecture-english.svg) | docs/presentation/07-web-architecture-english.png |

## Generated exports

- [ADM-01_create_facility.svg](exports/ADM-01_create_facility.svg)
- [ADM-02_update_facility.svg](exports/ADM-02_update_facility.svg)
- [ADM-03_assign_facility_manager.svg](exports/ADM-03_assign_facility_manager.svg)
- [ADM-04_assign_facility_staff.svg](exports/ADM-04_assign_facility_staff.svg)
- [ADM-05_create_facility_coach.svg](exports/ADM-05_create_facility_coach.svg)
- [ADM-06_manage_sports.svg](exports/ADM-06_manage_sports.svg)
- [ADM-07_facility_overview_report.svg](exports/ADM-07_facility_overview_report.svg)
- [ADM-08_export_report_csv.svg](exports/ADM-08_export_report_csv.svg)
- [ADM-09_create_receptionist.svg](exports/ADM-09_create_receptionist.svg)
- [AUTH-01_guest_register_otp.svg](exports/AUTH-01_guest_register_otp.svg)
- [AUTH-02_user_login.svg](exports/AUTH-02_user_login.svg)
- [AUTH-03b_consume_reset_otp.svg](exports/AUTH-03b_consume_reset_otp.svg)
- [AUTH-03_forgot_reset_password.svg](exports/AUTH-03_forgot_reset_password.svg)
- [AUTH-04_refresh_session.svg](exports/AUTH-04_refresh_session.svg)
- [AUTH-05_logout.svg](exports/AUTH-05_logout.svg)
- [AUTH-06_update_profile.svg](exports/AUTH-06_update_profile.svg)
- [AUTH-07_change_password.svg](exports/AUTH-07_change_password.svg)
- [AUTH-08_upload_avatar.svg](exports/AUTH-08_upload_avatar.svg)
- [COA-01_view_schedule_students.svg](exports/COA-01_view_schedule_students.svg)
- [COA-02_take_attendance.svg](exports/COA-02_take_attendance.svg)
- [COA-04_request_coach_change.svg](exports/COA-04_request_coach_change.svg)
- [COA-05_view_member_profile.svg](exports/COA-05_view_member_profile.svg)
- [database-erd.svg](exports/database-erd.svg)
- [EXT-02_ai_assistant.svg](exports/EXT-02_ai_assistant.svg)
- [MEM-01_browse_memberships.svg](exports/MEM-01_browse_memberships.svg)
- [MEM-02_purchase_membership.svg](exports/MEM-02_purchase_membership.svg)
- [MEM-03_cancel_membership_refund.svg](exports/MEM-03_cancel_membership_refund.svg)
- [MEM-04_search_classes.svg](exports/MEM-04_search_classes.svg)
- [MEM-05_book_class.svg](exports/MEM-05_book_class.svg)
- [MEM-06_view_booking_status.svg](exports/MEM-06_view_booking_status.svg)
- [MEM-07_qr_check_in.svg](exports/MEM-07_qr_check_in.svg)
- [MEM-08_notifications.svg](exports/MEM-08_notifications.svg)
- [MEM-09b_chat_attachment.svg](exports/MEM-09b_chat_attachment.svg)
- [MEM-09_chat.svg](exports/MEM-09_chat.svg)
- [MEM-10_receipts.svg](exports/MEM-10_receipts.svg)
- [MEM-11_feedback_rating.svg](exports/MEM-11_feedback_rating.svg)
- [MEM-12_join_waitlist.svg](exports/MEM-12_join_waitlist.svg)
- [MEM-13_cancel_waitlist.svg](exports/MEM-13_cancel_waitlist.svg)
- [MEM-14_cancel_booking.svg](exports/MEM-14_cancel_booking.svg)
- [MEM-15_transfer_booking.svg](exports/MEM-15_transfer_booking.svg)
- [MEM-16_request_class_leave.svg](exports/MEM-16_request_class_leave.svg)
- [MEM-17_appeal_penalty.svg](exports/MEM-17_appeal_penalty.svg)
- [MEM-18_submit_issue.svg](exports/MEM-18_submit_issue.svg)
- [MEM-19_edit_open_issue.svg](exports/MEM-19_edit_open_issue.svg)
- [MEM-20_update_health_notes.svg](exports/MEM-20_update_health_notes.svg)
- [MGR-01_create_class_schedule_wizard.svg](exports/MGR-01_create_class_schedule_wizard.svg)
- [MGR-02_assign_coach.svg](exports/MGR-02_assign_coach.svg)
- [MGR-03_manage_memberships_tuition.svg](exports/MGR-03_manage_memberships_tuition.svg)
- [MGR-04_manage_staff_roles.svg](exports/MGR-04_manage_staff_roles.svg)
- [MGR-05_revenue_report.svg](exports/MGR-05_revenue_report.svg)
- [MGR-06_audit_log.svg](exports/MGR-06_audit_log.svg)
- [MGR-07_create_term.svg](exports/MGR-07_create_term.svg)
- [MGR-08_update_term.svg](exports/MGR-08_update_term.svg)
- [MGR-09_create_room.svg](exports/MGR-09_create_room.svg)
- [MGR-10_update_room.svg](exports/MGR-10_update_room.svg)
- [MGR-11_transfer_room_schedules.svg](exports/MGR-11_transfer_room_schedules.svg)
- [MGR-12_create_class.svg](exports/MGR-12_create_class.svg)
- [MGR-13_update_class.svg](exports/MGR-13_update_class.svg)
- [MGR-14_create_schedule_batch.svg](exports/MGR-14_create_schedule_batch.svg)
- [MGR-15_update_cancel_schedule.svg](exports/MGR-15_update_cancel_schedule.svg)
- [MGR-16_complete_session.svg](exports/MGR-16_complete_session.svg)
- [MGR-17_decide_coach_change.svg](exports/MGR-17_decide_coach_change.svg)
- [MGR-18_decide_member_staff_leave.svg](exports/MGR-18_decide_member_staff_leave.svg)
- [MGR-19_apply_penalty.svg](exports/MGR-19_apply_penalty.svg)
- [MGR-20_revoke_penalty.svg](exports/MGR-20_revoke_penalty.svg)
- [MGR-21_review_attendance_report.svg](exports/MGR-21_review_attendance_report.svg)
- [MGR-22_correct_attendance.svg](exports/MGR-22_correct_attendance.svg)
- [MGR-23_attendance_report.svg](exports/MGR-23_attendance_report.svg)
- [MGR-24_cross_facility_usage.svg](exports/MGR-24_cross_facility_usage.svg)
- [OPS-01_update_room_capabilities.svg](exports/OPS-01_update_room_capabilities.svg)
- [OPS-02_update_coach_specializations.svg](exports/OPS-02_update_coach_specializations.svg)
- [OPS-03_create_time_slot.svg](exports/OPS-03_create_time_slot.svg)
- [OPS-04_create_schedule_pattern.svg](exports/OPS-04_create_schedule_pattern.svg)
- [OPS-05_resolve_support_issue.svg](exports/OPS-05_resolve_support_issue.svg)
- [OPS-06_trigger_class_reminders.svg](exports/OPS-06_trigger_class_reminders.svg)
- [OPS-07_scan_attendance_warnings.svg](exports/OPS-07_scan_attendance_warnings.svg)
- [PAY-01_sepay_webhook_settlement.svg](exports/PAY-01_sepay_webhook_settlement.svg)
- [PAY-02_poll_checkout_reconcile.svg](exports/PAY-02_poll_checkout_reconcile.svg)
- [PAY-03_retry_activation.svg](exports/PAY-03_retry_activation.svg)
- [PAY-04_approve_unactivated_refund.svg](exports/PAY-04_approve_unactivated_refund.svg)
- [presentation-1.svg](exports/presentation-1.svg)
- [presentation-2.svg](exports/presentation-2.svg)
- [presentation-3.svg](exports/presentation-3.svg)
- [presentation-4.svg](exports/presentation-4.svg)
- [presentation-5.svg](exports/presentation-5.svg)
- [presentation-6.svg](exports/presentation-6.svg)
- [presentation-7.svg](exports/presentation-7.svg)
- [presentation-8.svg](exports/presentation-8.svg)
- [REC-01_create_member.svg](exports/REC-01_create_member.svg)
- [REC-02_manage_booking_check_in.svg](exports/REC-02_manage_booking_check_in.svg)
- [REC-03_rotate_qr_session.svg](exports/REC-03_rotate_qr_session.svg)
- [REC-05_confirm_refund.svg](exports/REC-05_confirm_refund.svg)
- [REC-06_create_counter_order.svg](exports/REC-06_create_counter_order.svg)
- [REC-07_confirm_counter_order.svg](exports/REC-07_confirm_counter_order.svg)
- [REC-08_sell_membership.svg](exports/REC-08_sell_membership.svg)
- [REC-09_renew_membership.svg](exports/REC-09_renew_membership.svg)
- [REC-10_cancel_membership.svg](exports/REC-10_cancel_membership.svg)
- [REC-11_monitor_attendance.svg](exports/REC-11_monitor_attendance.svg)
- [REC-12_send_attendance_warning.svg](exports/REC-12_send_attendance_warning.svg)
- [REC-13_report_attendance_violation.svg](exports/REC-13_report_attendance_violation.svg)
- [REC-14_request_staff_leave.svg](exports/REC-14_request_staff_leave.svg)
- [sports-center-use-cases.svg](exports/sports-center-use-cases.svg)
- [SYS-01_waitlist_promotion.svg](exports/SYS-01_waitlist_promotion.svg)
- [SYS-02_subscription_lifecycle.svg](exports/SYS-02_subscription_lifecycle.svg)
- [SYS-03_notification_outbox.svg](exports/SYS-03_notification_outbox.svg)
- [SYS-04_socket_send_message.svg](exports/SYS-04_socket_send_message.svg)

## Audit documentation and verification tools changed

- [docs/architecture/DATABASE_ERD.md](../../docs/architecture/DATABASE_ERD.md) (modified)
- [docs/architecture/USE_CASES.md](../../docs/architecture/USE_CASES.md) (modified)
- [docs/diagram-audit/build-report.mjs](../../docs/diagram-audit/build-report.mjs) (created)
- [docs/diagram-audit/findings.json](../../docs/diagram-audit/findings.json) (created)
- [docs/diagram-audit/inspect-layout.mjs](../../docs/diagram-audit/inspect-layout.mjs) (created)
- [docs/diagram-audit/layout-review.json](../../docs/diagram-audit/layout-review.json) (created)
- [docs/diagram-audit/REPORT.md](../../docs/diagram-audit/REPORT.md) (created)
- [docs/diagram-audit/style.mjs](../../docs/diagram-audit/style.mjs) (created)
- [docs/diagram-audit/traceability.json](../../docs/diagram-audit/traceability.json) (created)
- [docs/diagram-audit/TRACEABILITY.md](../../docs/diagram-audit/TRACEABILITY.md) (created)
- [docs/diagram-audit/update-erd.mjs](../../docs/diagram-audit/update-erd.mjs) (created)
- [docs/diagram-audit/validation.json](../../docs/diagram-audit/validation.json) (created)
- [docs/diagram-audit/verify-all.mjs](../../docs/diagram-audit/verify-all.mjs) (created)
- [docs/presentation/06-web-architecture-review.md](../../docs/presentation/06-web-architecture-review.md) (modified)
- [docs/presentation/07-english-image-prompt.txt](../../docs/presentation/07-english-image-prompt.txt) (modified)
- [docs/presentation/generate_visuals.py](../../docs/presentation/generate_visuals.py) (modified)
- [docs/presentation/README.md](../../docs/presentation/README.md) (modified)
- [docs/presentation/render_png.cjs](../../docs/presentation/render_png.cjs) (modified)
- [docs/sequence-diagrams/audit-results.json](../../docs/sequence-diagrams/audit-results.json) (modified)
- [docs/sequence-diagrams/AUDIT_REPORT.vi.md](../../docs/sequence-diagrams/AUDIT_REPORT.vi.md) (modified)
- [docs/sequence-diagrams/catalog.json](../../docs/sequence-diagrams/catalog.json) (modified)
- [docs/sequence-diagrams/checksums.json](../../docs/sequence-diagrams/checksums.json) (modified)
- [docs/sequence-diagrams/COVERAGE.md](../../docs/sequence-diagrams/COVERAGE.md) (modified)
- [docs/sequence-diagrams/INDEX.md](../../docs/sequence-diagrams/INDEX.md) (modified)
- [docs/sequence-diagrams/README.md](../../docs/sequence-diagrams/README.md) (modified)
- [docs/sequence-diagrams/validation-results.json](../../docs/sequence-diagrams/validation-results.json) (modified)
- [docs/sequence-diagrams/verify.mjs](../../docs/sequence-diagrams/verify.mjs) (modified)

Frontend, Backend, schema, migrations, application dependencies and lockfiles remain unchanged. No commit/push/deploy.

## Additional authoring sources reviewed

- [generate_visuals.py](../presentation/generate_visuals.py): palette, content and embedded Mermaid configuration aligned; Python execution unverified (missing interpreter).
- [render_png.cjs](../presentation/render_png.cjs): portable Chromium and SVG-bound screenshots; executed for all 7 SVGs.
- [use-cases.json](../presentation/use-cases.json): corrected Coach replacement-request label.
- [Historical English image prompt](../presentation/07-english-image-prompt.txt): marked superseded palette and current SVG source.

- [FILES.md](FILES.md) and [inventory.json](inventory.json) are the self-describing manifest files.

- [Final checks](final-checks.json): current source hashes, evidence ranges, JavaScript syntax, local links and protected application files.
