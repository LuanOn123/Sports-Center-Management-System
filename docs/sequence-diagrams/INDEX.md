# SCMS sequence diagram index

[Repository-wide audit](../diagram-audit/REPORT.md) · [Full traceability](../diagram-audit/TRACEABILITY.md) · [Import and exports](README.md)

| Diagram | Workflow | Business review |
|---|---|---|
| [ADM-01_create_facility](ADM-01_create_facility.mmd) | Admin tạo cơ sở | PASS |
| [ADM-02_update_facility](ADM-02_update_facility.mmd) | Admin sửa hoặc ngừng cơ sở | PASS |
| [ADM-03_assign_facility_manager](ADM-03_assign_facility_manager.mmd) | Admin phân công hoặc thay quản lý cơ sở | PASS |
| [ADM-04_assign_facility_staff](ADM-04_assign_facility_staff.mmd) | Phân công HLV vào cơ sở | PASS |
| [ADM-05_create_facility_coach](ADM-05_create_facility_coach.mmd) | Tạo HLV và phân công cơ sở | PASS |
| [ADM-06_manage_sports](ADM-06_manage_sports.mmd) | Admin tạo bộ môn và yêu cầu thiết bị | PASS |
| [ADM-07_facility_overview_report](ADM-07_facility_overview_report.mmd) | Admin so sánh các cơ sở | PASS |
| [ADM-08_export_report_csv](ADM-08_export_report_csv.mmd) | Xuất báo cáo tổng hợp CSV từ trình duyệt | NEED_REVIEW |
| [ADM-09_create_receptionist](ADM-09_create_receptionist.mmd) | Tạo lễ tân cho cơ sở | PASS |
| [AUTH-01_guest_register_otp](AUTH-01_guest_register_otp.mmd) | Đăng ký tài khoản hội viên, chưa có OTP đăng ký | PASS |
| [AUTH-02_user_login](AUTH-02_user_login.mmd) | Đăng nhập với CAPTCHA và kiểm tra đồng bộ tài khoản | PASS |
| [AUTH-03_forgot_reset_password](AUTH-03_forgot_reset_password.mmd) | Yêu cầu OTP đặt lại mật khẩu | PASS |
| [AUTH-03b_consume_reset_otp](AUTH-03b_consume_reset_otp.mmd) | Xác minh OTP và đặt mật khẩu mới | PASS |
| [AUTH-04_refresh_session](AUTH-04_refresh_session.mmd) | Làm mới access token | PASS |
| [AUTH-05_logout](AUTH-05_logout.mmd) | Đăng xuất phiên hiện tại | PASS |
| [AUTH-06_update_profile](AUTH-06_update_profile.mmd) | Cập nhật hồ sơ cá nhân | PASS |
| [AUTH-07_change_password](AUTH-07_change_password.mmd) | Đổi mật khẩu khi đã đăng nhập | PASS |
| [AUTH-08_upload_avatar](AUTH-08_upload_avatar.mmd) | Tải ảnh đại diện | PASS |
| [COA-01_view_schedule_students](COA-01_view_schedule_students.mmd) | HLV xem lịch và danh sách học viên | PASS |
| [COA-02_take_attendance](COA-02_take_attendance.mmd) | HLV điểm danh trực tiếp | NEED_REVIEW |
| [COA-04_request_coach_change](COA-04_request_coach_change.mmd) | HLV xin đổi người dạy một buổi | PASS |
| [COA-05_view_member_profile](COA-05_view_member_profile.mmd) | HLV xem thông tin học viên liên quan | PASS |
| [EXT-02_ai_assistant](EXT-02_ai_assistant.mmd) | Chatbot trả lời bằng dữ liệu trung tâm | PASS |
| [MEM-01_browse_memberships](MEM-01_browse_memberships.mmd) | Xem danh mục gói tập | PASS |
| [MEM-02_purchase_membership](MEM-02_purchase_membership.mmd) | Hội viên tạo đơn thanh toán QR SePay | NEED_REVIEW |
| [MEM-03_cancel_membership_refund](MEM-03_cancel_membership_refund.mmd) | Hội viên tự hủy gói và yêu cầu hoàn theo chính sách | PASS |
| [MEM-04_search_classes](MEM-04_search_classes.mmd) | Tìm lớp theo cơ sở và xem lịch khóa | PASS |
| [MEM-05_book_class](MEM-05_book_class.mmd) | Đăng ký trọn khóa | NEED_REVIEW |
| [MEM-06_view_booking_status](MEM-06_view_booking_status.mmd) | Xem lịch đã đăng ký | PASS |
| [MEM-07_qr_check_in](MEM-07_qr_check_in.mmd) | Quét QR điểm danh lớp | NEED_REVIEW |
| [MEM-08_notifications](MEM-08_notifications.mmd) | Xem thông báo và đánh dấu đã đọc | PASS |
| [MEM-09_chat](MEM-09_chat.mmd) | UI gửi tin nhắn HTTP và nhận sự kiện realtime | PASS |
| [MEM-09b_chat_attachment](MEM-09b_chat_attachment.mmd) | Gửi tệp đính kèm chat có phân quyền | PASS |
| [MEM-10_receipts](MEM-10_receipts.mmd) | Xem lịch sử hóa đơn của chính mình | PASS |
| [MEM-11_feedback_rating](MEM-11_feedback_rating.mmd) | Đánh giá HLV sau khi đã tham gia học | PASS |
| [MEM-12_join_waitlist](MEM-12_join_waitlist.mmd) | Vào danh sách chờ buổi đã đầy | PASS |
| [MEM-13_cancel_waitlist](MEM-13_cancel_waitlist.mmd) | Rời danh sách chờ | PASS |
| [MEM-14_cancel_booking](MEM-14_cancel_booking.mmd) | Hủy đặt buổi học và xét đôn danh sách chờ | PASS |
| [MEM-15_transfer_booking](MEM-15_transfer_booking.mmd) | Chuyển buổi trong cùng lớp | PASS |
| [MEM-16_request_class_leave](MEM-16_request_class_leave.mmd) | Hội viên xin nghỉ buổi học | PASS |
| [MEM-17_appeal_penalty](MEM-17_appeal_penalty.mmd) | Khiếu nại quyết định chuyên cần | PASS |
| [MEM-18_submit_issue](MEM-18_submit_issue.mmd) | Gửi yêu cầu hỗ trợ | PASS |
| [MEM-19_edit_open_issue](MEM-19_edit_open_issue.mmd) | Sửa yêu cầu hỗ trợ chưa xử lý | PASS |
| [MEM-20_update_health_notes](MEM-20_update_health_notes.mmd) | Hội viên cập nhật lưu ý sức khỏe theo đăng ký | NEED_REVIEW |
| [MGR-01_create_class_schedule_wizard](MGR-01_create_class_schedule_wizard.mmd) | Quản lý tạo lớp và lịch bằng wizard | NEED_REVIEW |
| [MGR-02_assign_coach](MGR-02_assign_coach.mmd) | Phân công HLV chính cho lớp | PASS |
| [MGR-03_manage_memberships_tuition](MGR-03_manage_memberships_tuition.mmd) | Admin quản lý danh mục gói và học phí | PASS |
| [MGR-04_manage_staff_roles](MGR-04_manage_staff_roles.mmd) | Admin đổi vai trò hoặc trạng thái tài khoản | NEED_REVIEW |
| [MGR-05_revenue_report](MGR-05_revenue_report.mmd) | Xem báo cáo thu chi theo ngày Việt Nam | PASS |
| [MGR-06_audit_log](MGR-06_audit_log.mmd) | Xem nhật ký kiểm toán | PASS |
| [MGR-07_create_term](MGR-07_create_term.mmd) | Tạo kỳ học | PASS |
| [MGR-08_update_term](MGR-08_update_term.mmd) | Cập nhật kỳ học và trạng thái đăng ký | PASS |
| [MGR-09_create_room](MGR-09_create_room.mmd) | Tạo phòng tập | PASS |
| [MGR-10_update_room](MGR-10_update_room.mmd) | Sửa phòng tập an toàn với lịch đang giữ | PASS |
| [MGR-11_transfer_room_schedules](MGR-11_transfer_room_schedules.mmd) | Chuyển toàn bộ lịch khỏi phòng hỏng | PASS |
| [MGR-12_create_class](MGR-12_create_class.mmd) | Tạo lớp dùng phòng và bộ môn có sẵn | PASS |
| [MGR-13_update_class](MGR-13_update_class.mmd) | Cập nhật lớp đang hoạt động | PASS |
| [MGR-14_create_schedule_batch](MGR-14_create_schedule_batch.mmd) | Tạo lịch cho lớp đã có | PASS |
| [MGR-15_update_cancel_schedule](MGR-15_update_cancel_schedule.mmd) | Dời hoặc hủy buổi học | PASS |
| [MGR-16_complete_session](MGR-16_complete_session.mmd) | Hoàn tất buổi học và ghi vắng mặc định | PASS |
| [MGR-17_decide_coach_change](MGR-17_decide_coach_change.mmd) | Quản lý duyệt hoặc từ chối đổi HLV | PASS |
| [MGR-18_decide_member_staff_leave](MGR-18_decide_member_staff_leave.mmd) | Quản lý duyệt nghỉ học hoặc nghỉ phép | PASS |
| [MGR-19_apply_penalty](MGR-19_apply_penalty.mmd) | Quản lý áp dụng hạn chế chuyên cần có lý do | NEED_REVIEW |
| [MGR-20_revoke_penalty](MGR-20_revoke_penalty.mmd) | Gỡ quyết định và khôi phục chỗ khi an toàn | NEED_REVIEW |
| [MGR-21_review_attendance_report](MGR-21_review_attendance_report.mmd) | Quản lý xét báo cáo vi phạm từ lễ tân | PASS |
| [MGR-22_correct_attendance](MGR-22_correct_attendance.mmd) | Quản lý sửa điểm danh đã ghi | PASS |
| [MGR-23_attendance_report](MGR-23_attendance_report.mmd) | Xem báo cáo chuyên cần tổng hợp | NEED_REVIEW |
| [MGR-24_cross_facility_usage](MGR-24_cross_facility_usage.mmd) | Xem việc sử dụng gói giữa các cơ sở | NEED_REVIEW |
| [OPS-01_update_room_capabilities](OPS-01_update_room_capabilities.mmd) | Cập nhật dụng cụ phòng và kiểm tra lịch phụ thuộc | PASS |
| [OPS-02_update_coach_specializations](OPS-02_update_coach_specializations.mmd) | Quản lý sửa chuyên môn HLV | PASS |
| [OPS-03_create_time_slot](OPS-03_create_time_slot.mmd) | Tạo ca giờ cho lịch mẫu | NEED_REVIEW |
| [OPS-04_create_schedule_pattern](OPS-04_create_schedule_pattern.mmd) | Tạo lịch lặp từ ngày và ca giờ | NEED_REVIEW |
| [OPS-05_resolve_support_issue](OPS-05_resolve_support_issue.mmd) | Nhân viên xử lý yêu cầu hỗ trợ | PASS |
| [OPS-06_trigger_class_reminders](OPS-06_trigger_class_reminders.mmd) | Gửi nhắc lịch học sắp tới | NEED_REVIEW |
| [OPS-07_scan_attendance_warnings](OPS-07_scan_attendance_warnings.mmd) | Quét cảnh báo chuyên cần tham khảo | NEED_REVIEW |
| [PAY-01_sepay_webhook_settlement](PAY-01_sepay_webhook_settlement.mmd) | SePay callback xác nhận thu tiền và cấp quyền | PASS |
| [PAY-02_poll_checkout_reconcile](PAY-02_poll_checkout_reconcile.mmd) | Xem trạng thái thanh toán và đối soát dự phòng | PASS |
| [PAY-03_retry_activation](PAY-03_retry_activation.mmd) | Admin cấp gói bù cho khoản đã thu đang đối soát | PASS |
| [PAY-04_approve_unactivated_refund](PAY-04_approve_unactivated_refund.mmd) | Admin duyệt hoàn ngoại lệ chưa cấp quyền | PASS |
| [REC-01_create_member](REC-01_create_member.mmd) | Lễ tân tạo hội viên tại quầy | NEED_REVIEW |
| [REC-02_manage_booking_check_in](REC-02_manage_booking_check_in.mmd) | Ghi nhận lượt vào cửa cơ sở | NEED_REVIEW |
| [REC-03_rotate_qr_session](REC-03_rotate_qr_session.mmd) | Coach tạo và làm mới QR | NEED_REVIEW |
| [REC-05_confirm_refund](REC-05_confirm_refund.mmd) | Xác nhận khoản tiền đã thực hoàn | PASS |
| [REC-06_create_counter_order](REC-06_create_counter_order.mmd) | Lập đơn bán gói tại quầy | PASS |
| [REC-07_confirm_counter_order](REC-07_confirm_counter_order.mmd) | Xác nhận đã thu tiền và cấp gói tại quầy | PASS |
| [REC-08_sell_membership](REC-08_sell_membership.mmd) | Bán và ghi nhận thu gói trực tiếp | PASS |
| [REC-09_renew_membership](REC-09_renew_membership.mmd) | Gia hạn hoặc chuyển hạng gói | PASS |
| [REC-10_cancel_membership](REC-10_cancel_membership.mmd) | Nhân viên hủy gói và ghi yêu cầu hoàn theo chính sách | PASS |
| [REC-11_monitor_attendance](REC-11_monitor_attendance.mmd) | Theo dõi chuyên cần | NEED_REVIEW |
| [REC-12_send_attendance_warning](REC-12_send_attendance_warning.mmd) | Gửi cảnh báo chuyên cần | NEED_REVIEW |
| [REC-13_report_attendance_violation](REC-13_report_attendance_violation.mmd) | Lễ tân báo cáo vi phạm cho quản lý | NEED_REVIEW |
| [REC-14_request_staff_leave](REC-14_request_staff_leave.mmd) | Lễ tân xin nghỉ phép | NEED_REVIEW |
| [SYS-01_waitlist_promotion](SYS-01_waitlist_promotion.mmd) | Đôn danh sách chờ khi có chỗ | PASS |
| [SYS-02_subscription_lifecycle](SYS-02_subscription_lifecycle.mmd) | Job kích hoạt gói chờ và hết hạn gói | PASS |
| [SYS-03_notification_outbox](SYS-03_notification_outbox.mmd) | Gửi lại thông báo qua outbox | NEED_REVIEW |
| [SYS-04_socket_send_message](SYS-04_socket_send_message.mmd) | Giao thức Socket.IO sendMessage đã triển khai | PASS |
