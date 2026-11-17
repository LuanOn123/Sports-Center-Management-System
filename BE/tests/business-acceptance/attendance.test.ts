import { at, cases, MINUTE, schemaCases } from "./support.js";
import assert from "node:assert/strict";
import { absenceAllowance, classifyAttendance, classifyFixedAbsence } from "../../src/config/attendance.js";
import { buildCoverageIntervals, isCoveredAt } from "../../src/modules/attendance/attendance-analytics.service.js";
import { ScanQrSchema, SaveEvaluationSchema } from "../../src/modules/attendance/attendance.schema.js";
import { attendanceSummary } from "../../src/modules/attendance/reception-attendance.service.js";

cases("BR-ATT-ADVISORY", [
  ["dưới 5 buổi chưa đủ mẫu đánh giá dù vắng toàn bộ", 0, 4, "NORMAL"],
  ["lớp định kỳ đúng 5 buổi có thể phát cảnh báo", 60, 5, "WARNING"],
  ["tỷ lệ có mặt ngay dưới 70 phần trăm là cảnh báo", 69.99, 10, "WARNING"],
  ["đúng 70 phần trăm là nhắc nhở", 70, 10, "NOTICE"],
  ["ngay dưới 80 phần trăm vẫn là nhắc nhở", 79.99, 10, "NOTICE"],
  ["đúng 80 phần trăm trở về bình thường", 80, 5, "NORMAL"],
] as const, ([, rate, sample, expected]) => assert.equal(classifyAttendance(rate, sample), expected));

cases("BR-ATT-FIXED", [
  ["khóa 4 buổi không vắng thì bình thường", 4, 0, 0, "NORMAL"],
  ["khóa 4 buổi vắng một lần đã quá ngưỡng", 4, 1, 0, "WARNING"],
  ["khóa 5 buổi vắng đúng 20 phần trăm là nhắc nhở", 5, 1, 1, "NOTICE"],
  ["khóa 9 buổi làm tròn xuống một lần vắng", 9, 2, 1, "WARNING"],
  ["khóa 10 buổi cho phép hai lần vắng trước ngưỡng cảnh báo", 10, 2, 2, "NOTICE"],
] as const, ([, planned, absences, allowance, status]) => {
  assert.equal(absenceAllowance(planned), allowance);
  assert.equal(classifyFixedAbsence(absences, allowance), status);
});

cases("BR-ATT-RECEPTION", [
  ["mẫu trống chưa đủ dữ kiện báo vi phạm", [], 0, 0, 0, "NORMAL"],
  ["vắng có phép được loại khỏi mẫu số", ["ABSENT", "PRESENT", "PRESENT", "PRESENT", "EXCUSED"], 1, 4, 25, "WARNING"],
  ["vắng đúng 20 phần trăm là cảnh báo lễ tân", ["ABSENT", "PRESENT", "PRESENT", "PRESENT", "LATE"], 1, 5, 20, "WARNING"],
  ["vắng đúng 30 phần trăm là vi phạm lễ tân",
    ["ABSENT", "ABSENT", "ABSENT", "PRESENT", "PRESENT", "PRESENT", "PRESENT", "PRESENT", "PRESENT", "PRESENT"], 3, 10, 30, "VIOLATION"],
  ["đi trễ được tính là có tham dự", ["PRESENT", "LATE", "LATE"], 0, 3, 0, "NORMAL"],
] as const, ([, states, absences, total, rate, status]) => {
  const result = attendanceSummary(states.map(state => ({ state })));
  assert.deepEqual([result.absentCount, result.totalRelevantClassSessions, result.absenceRate, result.status],
    [absences, total, rate, status]);
  assert.equal(result.attendedCount, states.filter(state => state === "PRESENT" || state === "LATE").length);
});

cases("BR-ATT-HISTORY", [
  ["hủy gói sau buổi học giữ quyền tại thời điểm đã học", "CANCELLED", 90, undefined, 45, true],
  ["hủy sớm thu hồi quyền ở buổi tương lai", "CANCELLED", 20, undefined, 45, false],
  ["thay gói sau buổi học không xóa quyền lịch sử", "SUSPENDED", undefined, 90, 45, true],
  ["thay gói trước buổi học kết thúc quyền gói cũ", "SUSPENDED", undefined, 20, 45, false],
  ["hết hạn hôm nay không làm mất lịch sử trong thời hạn", "EXPIRED", undefined, undefined, 60, true],
  ["sau mốc hết hạn một mili giây mất quyền gốc", "EXPIRED", undefined, undefined, 60 + 1 / MINUTE, false],
] as const, ([, status, cancel, suspend, checked, covered]) => {
  const history = buildCoverageIntervals([{
    startDate: at(0), endDate: at(60 * MINUTE), status,
    cancelledAt: cancel === undefined ? null : at(cancel * MINUTE),
    suspendedAt: suspend === undefined ? null : at(suspend * MINUTE),
  }]);
  assert.equal(isCoveredAt(history, at(checked * MINUTE)), covered);
});

schemaCases("BR-ATT-CHECKIN", ScanQrSchema, [
  ["chấp nhận cung cấp QR riêng", { qrToken: "fixture-token" }, true],
  ["chấp nhận mã dự phòng chữ thường có khoảng trắng", { code: " abcd23 " }, true],
  ["từ chối gửi QR và mã cùng lúc", { qrToken: "fixture-token", code: "ABCD23" }, false],
  ["từ chối ghi điểm danh trực tiếp theo mã buổi tự điền", { scheduleId: "slot-a" }, false],
  ["không chấp nhận mã có chữ O dễ nhầm", { code: "ABCD2O" }, false, "code"],
  ["không chấp nhận mã có số 0 dễ nhầm", { code: "ABCD20" }, false, "code"],
  ["không chấp nhận mã thiếu ký tự", { code: "ABCDE" }, false, "code"],
]);

schemaCases("BR-ATT-EVALUATION", SaveEvaluationSchema, [
  ["ghi tiến độ ban đầu bằng 0 phần trăm", { memberId: "m", progress: 0 }, true],
  ["hoàn thành mục tiêu ở đúng 100 phần trăm", { memberId: "m", progress: 100, results: "Hoàn thành bài tập" }, true],
  ["tiến độ vượt 100 phần trăm bị chặn", { memberId: "m", progress: 100.01 }, false, "progress"],
  ["không ghi tiến độ âm", { memberId: "m", progress: -0.01 }, false, "progress"],
]);
