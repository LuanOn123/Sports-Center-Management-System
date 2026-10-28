import { expect, test, type Page } from "@playwright/test";
import { setup } from "./fixtures";

async function fixture(page: Page, initiallyRegistered = false) {
  await setup(page, "MEMBER");
  const state = {
    registered: initiallyRegistered,
    cancelledSession: false,
    failRefresh: false,
    refreshes: 0,
    posts: 0,
    holdRefresh: false,
  };
  let releaseRefresh!: () => void;
  const refreshGate = new Promise<void>((resolve) => {
    releaseRefresh = resolve;
  });
  const times = ["2099-10-01T11:00:00Z", "2099-10-08T11:00:00Z"];
  const plan = () => ({
    course: {
      classId: "c1",
      className: "Yoga học kỳ 1",
      description: "",
      classType: "REGULAR",
      areaType: "INDOOR",
      capacity: 10,
      sports: [{ id: "yoga", name: "Yoga" }],
      totalSessions: 2,
      firstSessionStart: times[0],
      lastSessionStart: times[1],
      lastSessionEnd: "2099-10-08T12:00:00Z",
      weekdays: [4],
      weekdayLabels: ["Thứ 5"],
      timeSlots: [],
      rooms: [],
      slots: [],
      availability: {
        minRemainingSlots: state.registered ? 4 : 5,
        fullSessionCount: 0,
        isFullyBookable: true,
      },
    },
    sessions: times.map((startTime, index) => ({
      id: `session-${index}`,
      startTime,
      endTime: startTime.replace("11:00:00", "12:00:00"),
      status: "SCHEDULED",
      weekday: 4,
      weekdayLabel: "Thứ 5",
      timeLabel: "18:00–19:00",
      durationMinutes: 60,
      room: { id: "room-1", name: "Phòng Yoga" },
      bookedCount: state.registered ? 6 : 5,
      remainingSlots: state.registered ? 4 : 5,
      isFull: false,
      isBookable: true,
      canBook: !state.registered,
      myEnrollmentId: state.registered ? `enrollment-${index}` : null,
      myEnrollmentStatus: state.registered
        ? state.cancelledSession && index === 1
          ? "CANCELLED"
          : "BOOKED"
        : null,
      conflictWith: null,
    })),
    registration: {
      eligible: true,
      blockers: [],
      subscription: null,
      quota: null,
      penalty: null,
      registeredSessions: state.registered
        ? state.cancelledSession
          ? 1
          : 2
        : 0,
      remainingSessionsToRegister: state.registered
        ? state.cancelledSession
          ? 1
          : 0
        : 2,
      isFullyRegistered: state.registered && !state.cancelledSession,
    },
  });
  await page.route("**/api/v1/classes/c1/course-plan", async (route) => {
    if (state.posts) {
      state.refreshes++;
      if (state.holdRefresh) await refreshGate;
      if (state.failRefresh)
        return route.fulfill({
          status: 503,
          json: { success: false, message: "Không thể tải lại khóa học" },
        });
    }
    return route.fulfill({ json: { success: true, data: plan() } });
  });
  await page.route("**/api/v1/enrollments/bulk", async (route) => {
    state.posts++;
    state.registered = true;
    state.cancelledSession = false;
    return route.fulfill({
      json: {
        success: true,
        data: {
          classId: "c1",
          className: "Yoga học kỳ 1",
          summary: {
            totalSessions: 2,
            enrolledNow: 2,
            alreadyBooked: 0,
            totalRegistered: 2,
            firstSessionStart: times[0],
            lastSessionEnd: "2099-10-08T12:00:00Z",
          },
          sessions: times.map((startTime, index) => ({
            scheduleId: `session-${index}`,
            enrollmentId: `enrollment-${index}`,
            startTime,
            endTime: startTime.replace("11:00:00", "12:00:00"),
            roomId: "room-1",
            roomName: "Phòng Yoga",
            status: "BOOKED",
          })),
          quota: { limit: 3, used: 1, remaining: 2 },
        },
      },
    });
  });
  await page.goto("/member/classes/c1");
  return { state, releaseRefresh };
}

async function enroll(page: Page) {
  await page
    .getByRole("button", { name: "Đăng ký trọn khóa", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Xác nhận đăng ký trọn khóa", exact: true })
    .click();
}

test("changes the button and session status immediately, before refresh completes, and survives reload", async ({
  page,
}) => {
  const { state, releaseRefresh } = await fixture(page);
  state.holdRefresh = true;
  await enroll(page);
  const registered = page.getByRole("button", {
    name: "Đã đăng ký trọn khóa",
    exact: true,
  });
  try {
    await expect(registered).toBeDisabled();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(
      page.getByRole("table").getByText("Đã đặt", { exact: true }),
    ).toHaveCount(2);
    expect(state.posts).toBe(1);
  } finally {
    releaseRefresh();
  }
  await expect.poll(() => state.refreshes).toBeGreaterThan(0);
  await page.reload();
  await expect(registered).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Đăng ký trọn khóa", exact: true }),
  ).toHaveCount(0);
  expect(state.posts).toBe(1);
});

test("shows the registered state when opening an already-enrolled course", async ({
  page,
}) => {
  const { state } = await fixture(page, true);
  await expect(
    page.getByRole("button", { name: "Đã đăng ký trọn khóa", exact: true }),
  ).toBeDisabled();
  expect(state.posts).toBe(0);
});

test("allows registration again if a session was cancelled", async ({
  page,
}) => {
  const { state } = await fixture(page, true);
  state.cancelledSession = true;
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Đăng ký trọn khóa", exact: true }),
  ).toBeEnabled();
  await enroll(page);
  await expect(
    page.getByRole("button", { name: "Đã đăng ký trọn khóa", exact: true }),
  ).toBeDisabled();
  expect(state.posts).toBe(1);
});

test("keeps the committed registration visible if refreshing the course fails", async ({
  page,
}) => {
  const { state } = await fixture(page);
  state.failRefresh = true;
  await enroll(page);
  await expect(
    page.getByRole("button", { name: "Đã đăng ký trọn khóa", exact: true }),
  ).toBeDisabled();
  await expect(page.getByRole("alert")).toContainText(
    "Không thể tải lại khóa học",
    { timeout: 15000 },
  );
  await expect(
    page.getByRole("button", { name: "Đã đăng ký trọn khóa", exact: true }),
  ).toBeDisabled();
  expect(state.posts).toBe(1);
});
