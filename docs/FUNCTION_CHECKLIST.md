# Function Checklist

ใช้สำหรับตรวจสอบ implementation ของแต่ละ function ว่าตรงตาม requirement หรือไม่

---

## Core & Layout

### `app/layout.tsx`

- [/] `RootLayout`

### `app/page.tsx`

- [/] `Home`
- [/] `PortalCard`
- [/] `PalletIcon`
- [/] `PhoneIcon`
- [/] `GaugeIcon`
- [/] `ArrowIcon`

### `app/not-found.tsx`

- [/] `NotFound`

### `middleware.ts`

- [ ] `middleware`

---

## Authentication

### `app/auth/login/page.tsx`

- [/] `LoginPage`
- [/] `LoginForm`

### `app/auth/register/page.tsx`

- [/] `RegisterPage`
- [/] `RegisterForm`

### `app/auth/forgot-password/page.tsx`

- [/] `ForgotPasswordPage`
- [/] `ForgotPasswordForm`

### `app/auth/reset-password/page.tsx`

- [/] `ResetPasswordPage`
- [/] `ResetPasswordForm`

---

## Shared Components

### `app/_components/AuthPanel.tsx`

- [ ] `AuthPanel`

### `app/_components/dialogs.tsx`

- [ ] `DialogPortal`
- [ ] `ConfirmDialog`
- [ ] `PromptDialog`

### `app/_components/ui.tsx`

- [ ] `Skeleton`
- [ ] `SkeletonText`
- [ ] `SkeletonCard`
- [ ] `SkeletonRow`
- [/] `PageHeader`
- [ ] `Card`
- [ ] `StatusBadge`
- [/] `EmptyState`
- [/] `Table`

### `app/_components/image-viewer.tsx`

- [ ] `ImageViewer`
- [ ] `useAttachmentUrls`

---

## Portal (Employee)

### `app/app/layout.tsx`

- [/] `PortalLayout`

### `app/app/page.tsx`

- [/] `PortalHome`
- [/] `readMe`
- [/] `QuickAction`
- [/] `SectionTitle`
- [/] `MenuItem`

### `app/app/dashboard/page.tsx`

- [ ] `AppDashboardPage`
- [ ] `KpiCard`
- [ ] `MiniStat`

### `app/app/balance/page.tsx`

- [/] `Page`

### `app/app/requests/page.tsx`

- [/] `Page`

### `app/app/requests/new/page.tsx`

- [/] `Page`

### `app/app/requests/new/_ModeTabs.tsx`

- [/] `ModeTabs`

### `app/app/requests/new/_RequesterBanner.tsx`

- [/] `RequesterBanner`

### `app/app/requests/new/_ConditionPicker.tsx`

- [/] `ConditionPicker`
- [/] `toneActive`

### `app/app/requests/new/_ItemsSection.tsx`

- [/] `ItemsSection`
- [/] `QuantityStepper`

### `app/app/requests/new/_AttachmentPicker.tsx`

- [/] `AttachmentPicker`
- [/] `compressImage`

### `app/app/requests/new/_MetaFields.tsx`

- [/] `MetaFields`

### `app/app/requests/new/_types.ts`

- [/] `MODE_LABEL`
- [/] `MODE_ACTIVE`
- [/] `CONDITIONS`
- [/] `PALETTE`
- [/] `INPUT_BASE`

### `app/app/requests/[id]/page.tsx`

- [/] `Page`
- [/] `fmtDate`
- [/] `fmtTime`
- [/] `InfoRow`
- [/] `ApprovalTimeline`
- [/] `AttachmentsBlock`
- [/] `AttachmentThumbs`
- [/] `AttachmentViewer`

### `app/app/approvals/page.tsx`

- [/] `Page`

### `app/app/approvals/history/page.tsx`

- [/] `Page`

### `app/app/warehouse-ops/page.tsx`

- [/] `Page`
- [/] `Counter`
- [/] `OpModal`

### `app/app/_shared.tsx`

- [/] `LiffTopBar`
- [/] `LiffEmpty`
- [/] `StatusPill`
- [/] `TYPE_LABEL`
- [/] `CONDITION_LABEL`
- [/] `RequestCard`

### `app/app/_fetch.ts`

- [/] `safeFetchJson`

---

## Admin (Manage)

### `app/manage/layout.tsx`

- [ ] `AdminLayout`

### `app/manage/page.tsx`

- [ ] `AdminDashboard`
- [ ] `Num`
- [ ] `GranularityLinks`
- [ ] `MiniStat`
- [ ] `ReadOnlyWarehouseTable`
- [ ] `StatCard`
- [ ] `EmptyBox`

### `app/manage/_shell.tsx`

- [ ] `AdminShell`

### `app/manage/_notification-bell.tsx`

- [ ] `NotificationBell`
- [ ] `relativeTime`

### `app/manage/dashboard-filters.tsx`

- [ ] `DashboardFilters`
- [ ] `ExportButton`

### `app/manage/trend-chart.tsx`

- [ ] `TrendChart`

### `app/manage/warehouse-ops-panel.tsx`

- [ ] `WarehouseOpsPanel`
- [ ] `OpModal`

### `app/manage/departments/page.tsx`

- [ ] `Page`

### `app/manage/departments/client.tsx`

- [ ] `Modal`
- [ ] `DepartmentAdd`
- [ ] `DepartmentEdit`
- [ ] `SectionsManager`
- [ ] `DepartmentToggle`

### `app/manage/pallet-types/page.tsx`

- [ ] `Page`

### `app/manage/pallet-types/client.tsx`

- [ ] `Modal`
- [ ] `Field`
- [ ] `PalletTypeAdd`
- [ ] `PalletTypeEdit`

### `app/manage/operating-hours/page.tsx`

- [ ] `Page`

### `app/manage/operating-hours/client.tsx`

- [ ] `OperatingHoursClient`

### `app/manage/approval-routes/page.tsx`

- [ ] `Page`

### `app/manage/approval-routes/client.tsx`

- [ ] `ApprovalRoutesClient`
- [ ] `RouteFormModal`

### `app/manage/users/page.tsx`

- [ ] `Page`

### `app/manage/users/client.tsx`

- [ ] `UserEdit`

### `app/manage/requests/page.tsx`

- [ ] `Page`
- [ ] `isStatus`

### `app/manage/requests/[id]/page.tsx`

- [ ] `Page`
- [ ] `Row`
- [ ] `TL`

### `app/manage/requests/[id]/actions.tsx`

- [ ] `RequestActions`

### `app/manage/requests/[id]/attachment-gallery.tsx`

- [ ] `AttachmentGallery`

### `app/manage/adjustments/page.tsx`

- [/] `Page`

### `app/manage/adjustments/client.tsx`

- [/] `AdjustmentsClient`

### `app/manage/audit-logs/page.tsx`

- [ ] `Page`

---

## API Routes

### `app/api/auth/login/route.ts`

- [/] `POST`

### `app/api/auth/me/route.ts`

- [/] `GET`

### `app/api/auth/register/route.ts`

- [/] `POST`

### `app/api/auth/logout/route.ts`

- [ ] `POST`

### `app/api/auth/logout-and-redirect/route.ts`

- [/] `GET`

### `app/api/auth/forgot-password/route.ts`

- [/] `POST`

### `app/api/auth/reset-password/route.ts`

- [/] `GET`
- [/] `POST`

### `app/api/requests/route.ts`

- [/] `GET`
- [/] `POST`

### `app/api/requests/[id]/route.ts`

- [/] `GET`
- [/] `DELETE`

### `app/api/requests/[id]/approve/route.ts`

- [/] `POST`

### `app/api/requests/[id]/reject/route.ts`

- [/] `POST`

### `app/api/requests/[id]/edit-approve/route.ts`

- [ ] `POST`

### `app/api/requests/[id]/attachments/route.ts`

- [ ] `POST`

### `app/api/requests/[id]/warnings/route.ts`

- [ ] `GET`

### `app/api/balances/route.ts`

- [/] `GET`

### `app/api/adjustments/route.ts`

- [ ] `GET`
- [/] `POST`

### `app/api/departments/route.ts`

- [/] `GET`
- [ ] `POST`

### `app/api/departments/[id]/route.ts`

- [ ] `PATCH`

### `app/api/sections/route.ts`

- [/] `GET`
- [ ] `POST`

### `app/api/sections/[id]/route.ts`

- [ ] `PATCH`

### `app/api/pallet-types/route.ts`

- [/] `GET`
- [ ] `POST`

### `app/api/pallet-types/[id]/route.ts`

- [ ] `PATCH`

### `app/api/operating-hours/route.ts`

- [/] `GET`
- [ ] `POST`

### `app/api/operating-hours/[id]/route.ts`

- [ ] `PATCH`
- [ ] `DELETE`

### `app/api/operating-hours/holidays/route.ts`

- [ ] `GET`
- [ ] `POST`

### `app/api/operating-hours/holidays/[id]/route.ts`

- [ ] `DELETE`

### `app/api/approval-routes/route.ts`

- [ ] `GET`
- [ ] `POST`

### `app/api/approval-routes/[id]/route.ts`

- [ ] `DELETE`

### `app/api/users/[id]/route.ts`

- [ ] `PATCH`

### `app/api/notifications/route.ts`

- [ ] `GET`

### `app/api/notifications/mark-read/route.ts`

- [ ] `POST`

### `app/api/attachments/[id]/view-url/route.ts`

- [ ] `GET`

### `app/api/health/route.ts`

- [ ] `GET`

### `app/api/dashboard/export/route.ts`

- [ ] `GET`

### `app/api/warehouse-ops/summary/route.ts`

- [/] `GET`

### `app/api/warehouse-ops/repair/route.ts`

- [ ] `POST`

### `app/api/warehouse-ops/write-off/route.ts`

- [ ] `POST`

### `app/api/cron/send-emails/route.ts`

- [ ] `GET`

---

## Library / Services

### `lib/prisma.ts`

- [ ] `prisma`

### `lib/auth/current-user.ts`

- [ ] `getCurrentUser`
- [/] `getSessionUserAnyStatus`
- [/] `requireUser`
- [ ] `requireRole`
- [/] `HttpError`

### `lib/auth/session.ts`

- [/] `encodeSession`
- [/] `decodeSession`
- [/] `setSessionCookie`
- [/] `clearSessionCookie`
- [/] `readSession`

### `lib/auth/password.ts`

- [/] `hashPassword`
- [/] `verifyPassword`

### `lib/http/respond.ts`

- [/] `ok`
- [/] `fail`
- [ ] `readJson`

### `lib/supabase/admin.ts`

- [ ] `createSupabaseAdminClient`

### `lib/supabase/server.ts`

- [ ] `createSupabaseServerClient`

### `lib/supabase/browser.ts`

- [ ] `createSupabaseBrowserClient`

### `lib/stock.ts`

- [ ] `getBalance`
- [ ] `getDepartmentBalances`

### `lib/server/stock/index.ts`

- [/] `moveStock`

### `lib/services/request.ts`

- [/] `getAvailableBalance`
- [/] `createRequest`
- [/] `cancelRequest`
- [/] `approveRequest`
- [/] `rejectRequest`
- [ ] `editAndApprove`
- [/] `adjustStock`
- [/] `listRequests`
- [/] `getRequestDetail`
- [/] `getRequestWarnings`

### `lib/services/approval-route.ts`

- [ ] `listRoutes`
- [ ] `getRoute`
- [ ] `upsertRoute`
- [ ] `deleteRoute`
- [/] `resolveRoute`
- [ ] `checkApproverRouteConflict`
- [/] `findActableStep`

### `lib/services/attachment.ts`

- [ ] `uploadAttachment`
- [ ] `getAttachmentViewUrl`

### `lib/services/audit.ts`

- [/] `writeAudit`
- [ ] `listAuditLogs`

### `lib/services/docno.ts`

- [/] `nextDocNo`
- [ ] `nextWarehouseOpDocNo`

### `lib/services/dashboard.ts`

- [ ] `getDashboardSummary`
- [ ] `getWarehouseStockTable`
- [ ] `getWarehouseMovements`
- [ ] `getIssueReturnByDepartment`
- [ ] `getIssueReturnByPerson`
- [ ] `getRepairQuality`
- [ ] `getApprovalStats`
- [ ] `getTrend`
- [ ] `getOutstandingByDepartment`

### `lib/services/email-outbox.ts`

- [/] `queueEmail`
- [/] `buildUserEmail`
- [ ] `buildRequestEmail`

### `lib/services/notification.ts`

- [/] `notifyApproversOfNewRequest`
- [/] `notifyRequestCompleted`
- [/] `notifyRequestRejected`
- [ ] `notifyEditApproved`
- [/] `notifyNewUserToAdmins`
- [ ] `notifyUserApprovalResult`

### `lib/services/operating-hours.ts`

- [/] `nowBangkok`
- [/] `checkOperatingHours`
- [ ] `listOperatingHours`
- [ ] `createOperatingHours`
- [ ] `updateOperatingHours`
- [ ] `deleteOperatingHours`
- [ ] `listHolidays`
- [ ] `createHoliday`
- [ ] `deleteHoliday`

### `lib/services/send-email.ts`

- [ ] `processEmailOutbox`

### `lib/services/warehouse.ts`

- [ ] `repairPallets`
- [ ] `writeOffPallets`
- [/] `getWarehouseConditionSummary`

### `lib/services/export.ts`

- [ ] `exportDashboardExcel`
