// lib/workflow.ts
// Hàm thuần dùng chung cho các màn nghiệp vụ nhỏ (WorkflowScreen)

import { ATTENDANCE_REPORT_MARKER, WORKFLOW_STATUS_LABEL } from '../constants/workflow';

/** Nhãn tiếng Việt của trạng thái bản ghi nghiệp vụ; trạng thái lạ giữ nguyên mã */
export const workflowStatus = (status: string) => WORKFLOW_STATUS_LABEL[status] ?? status;

/** Yêu cầu hỗ trợ là báo cáo chuyên cần do hệ thống tự gửi quản lý (nội dung là JSON, không đọc được với hội viên) */
export const isAttendanceReport = (description: string) => description.includes(ATTENDANCE_REPORT_MARKER);
