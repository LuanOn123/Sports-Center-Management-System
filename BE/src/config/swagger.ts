import swaggerJSDoc from "swagger-jsdoc";

const options: swaggerJSDoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Sports Center Management API",
      version: "1.0.0",
      description:
        "Backend API for Sports Center Management System – Flow 1 (User & Membership), Flow 2 (Class & Schedule), Flow 3 (Payment & Report)",
    },
    servers: [{ url: "http://localhost:8080/api/v1", description: "Development Server" }],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
      responses: {
        // -- Shared error responses --
        BadRequest: { description: "Bad request (validation or malformed body)" },
        Unauthorized: { description: "Missing, invalid or expired token" },
        Forbidden: { description: "Insufficient role permissions" },
        NotFound: { description: "Resource not found" },
        Conflict: { description: "Duplicate value or business conflict" },
        ServerError: { description: "Unexpected internal server error" },
        // -- Auth --
        LoginOk: { description: "Login successful, returns access + refresh tokens" },
        RegisterCreated: { description: "Registration successful, returns the created member account" },
        RefreshOk: { description: "New access token issued from a valid refresh token" },
        MessageOk: { description: "Simple confirmation (data is null)" },
        ProfileOk: { description: "Current user profile (with role-specific profile)" },
        // -- Users --
        UserListOk: { description: "Paginated list of users (compact example)" },
        UserCreated: { description: "User created (member/coach/manager gets its profile)" },
        UserOk: { description: "Single user" },
        // -- Members & Coaches --
        MemberListOk: { description: "Paginated list of members (compact example)" },
        MemberOk: { description: "Single member with active subscription" },
        MembershipStatusOk: { description: "Effective member tier and active subscription" },
        CoachListOk: { description: "Paginated list of coaches (compact example)" },
        CoachOk: { description: "Coach details with assigned classes" },
        // -- Membership Plans & Subscriptions --
        PlanListOk: { description: "Paginated list of membership plans (compact example)" },
        PlanCreated: { description: "Plan created" },
        PlanOk: { description: "Single membership plan" },
        SubscriptionCreated: { description: "Subscription created with its payment" },
        SubscriptionListOk: { description: "Paginated list of subscriptions (compact example)" },
        SubscriptionOk: { description: "Single subscription" },
        // -- Sports & Rooms --
        SportListOk: { description: "Paginated list of sports (compact example)" },
        SportCreated: { description: "Sport created" },
        SportOk: { description: "Single sport" },
        RoomListOk: { description: "Paginated list of rooms (compact example)" },
        RoomCreated: { description: "Room created" },
        RoomOk: { description: "Single room" },
        // -- Classes --
        ClassListOk: { description: "Paginated list of classes (compact example)" },
        ClassCreated: { description: "Class created" },
        ClassOk: { description: "Single class with coaches and upcoming schedules" },
        // -- Class Schedules --
        ScheduleListOk: { description: "Paginated list of schedules (compact example)" },
        ScheduleCreated: { description: "Schedule created" },
        ScheduleOk: { description: "Single schedule with class/room and enrolled count" },
        // -- Enrollments --
        EnrollmentCreated: { description: "Class booked successfully" },
        EnrollmentListOk: { description: "Paginated list of enrollments (compact example)" },
        EnrollmentOk: { description: "Single enrollment" },
        // -- Payments & Invoices --
        PaymentCreated: { description: "Payment recorded (invoice auto-created on SUCCESS)" },
        PaymentListOk: { description: "Paginated list of payments (compact example)" },
        PaymentOk: { description: "Single payment" },
        InvoiceListOk: { description: "Paginated list of invoices (compact example)" },
        InvoiceOk: { description: "Single invoice" },
        // -- Reports --
        RevenueReportOk: { description: "Revenue report" },
        MemberReportOk: { description: "Member report" },
        EnrollmentReportOk: { description: "Enrollment report" },
        MembershipReportOk: { description: "Membership report" },
      },
    },
    security: [{ BearerAuth: [] }],
    tags: [
      { name: "Auth", description: "Authentication & profile" },
      { name: "Users", description: "User management (Manager)" },
      { name: "Members", description: "Member profiles" },
      { name: "Coaches", description: "Coach profiles" },
      { name: "Membership Plans", description: "Plan CRUD" },
      { name: "Subscriptions", description: "Member subscriptions" },
      { name: "Sports", description: "Sport / discipline management" },
      { name: "Rooms", description: "Room management" },
      { name: "Classes", description: "Class management" },
      { name: "Class Schedules", description: "Schedule management" },
      { name: "Enrollments", description: "Class booking" },
      { name: "Payments", description: "Payment recording" },
      { name: "Invoices", description: "Invoice management" },
      { name: "Reports", description: "Analytics & reports" },
    ],
  },
  apis: ["./src/modules/**/*.routes.ts", "./src/modules/**/*.routes.js"],
};

export const swaggerSpec = swaggerJSDoc(options);
