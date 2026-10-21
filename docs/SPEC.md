# SPEC — ระบบเบิกจ่ายพาเลท (Pallet Circulation System)

> **เวอร์ชัน:** 1.0 (สอดคล้อง implementation ปัจจุบัน — 2026-10-21)
> **เอกสารคู่กัน:** [`REQUIREMENTS.md`](./REQUIREMENTS.md) (business), [`ER_DIAGRAM.md`](./ER_DIAGRAM.md) (data model)

เอกสารนี้คือ **สเปคเชิงเทคนิค** ของระบบ — ครอบคลุมสถาปัตยกรรม, data model, state machine, API, business logic, validation, security, UI, และ deployment ที่ **ละเอียดพอให้ทีมใหม่ rebuild ได้ ≥ 90%**

---

## สารบัญ

1. [เป้าหมายและขอบเขต](#1-เป้าหมายและขอบเขต)
2. [สถาปัตยกรรมและ Tech Stack](#2-สถาปัตยกรรมและ-tech-stack)
3. [โครงสร้างโปรเจค](#3-โครงสร้างโปรเจค)
4. [Data Model](#4-data-model)
5. [Authentication & Authorization](#5-authentication--authorization)
6. [State Machine ของคำขอ](#6-state-machine-ของคำขอ)
7. [Core Business Logic](#7-core-business-logic)
8. [API Contract](#8-api-contract)
9. [Validation (Zod)](#9-validation-zod)
10. [Operating Hours & Timezone](#10-operating-hours--timezone)
11. [เลขเอกสาร (Doc Number)](#11-เลขเอกสาร-doc-number)
12. [การแจ้งเตือนและ Email Outbox](#12-การแจ้งเตือนและ-email-outbox)
13. [Attachments (Supabase Storage)](#13-attachments-supabase-storage)
14. [Dashboard & Excel Export](#14-dashboard--excel-export)
15. [Audit Log](#15-audit-log)
16. [UI / UX Specification](#16-ui--ux-specification)
17. [Business Rules & Invariants](#17-business-rules--invariants)
18. [Acceptance Criteria](#18-acceptance-criteria)
19. [Testing Strategy](#19-testing-strategy)
20. [Deployment & Environment](#20-deployment--environment)
21. [Migration Plan (ถ้า rebuild)](#21-migration-plan-ถ้า-rebuild)

---

## 1. เป้าหมายและขอบเขต

### 1.1 เป้าหมายของระบบ
1. บันทึกการเบิก-คืนพาเลทระหว่าง **คลังพาเลท** กับแผนกต่าง ๆ แบบตรวจย้อนได้ทุกธุรกรรม
2. รู้ยอดพาเลท **ในคลัง** ณ เวลาปัจจุบัน แยกตามประเภทและสภาพ
3. ควบคุมด้วย approval workflow หลายขั้น ที่ admin กำหนดได้รายแผนก
4. ตรวจสิทธิ์และช่วงเวลาทำรายการที่ server
5. Dashboard แสดง KPI + ยอด + รายงาน + Export Excel

### 1.2 ขอบเขตที่ **อยู่ใน** v1.0
- Web responsive (375px → desktop)
- Email + password authentication พร้อม admin approval
- 2 ประเภทคำขอ: `ISSUE` (เบิก), `RETURN` (คืน) — ผ่าน approval route
- 3 warehouse operations: `REPAIR_RESULT`, `WRITE_OFF`, `ADJUSTMENT` (bypass workflow)
- Dashboard + Audit log + Excel export + Attachment upload
- In-app + email notifications (outbox pattern + cron)

### 1.3 ขอบเขตที่ **อยู่นอก** v1.0
ดู `REQUIREMENTS.md §2.2` — สรุปสั้น ๆ:
- ไม่ติดตามยอดนอกคลัง (รู้แค่ movement in/out)
- ไม่ transfer ระหว่างแผนกโดยไม่ผ่านคลัง
- ไม่มี customer/supplier tracking
- ไม่มี per-unit tracking (bulk count)
- **ไม่มี urgent request** (คำขอด่วนนอกเวลา)
- **ไม่มี NEW_STOCK type แยก** — ใช้ `ADJUSTMENT` รับพาเลทใหม่
- ไม่มี LINE / SMS / ERP integration
- ไม่มี SUPER_ADMIN role

---

## 2. สถาปัตยกรรมและ Tech Stack

### 2.1 Architecture แบบย่อ

```
┌──────────────────────────────────────────────────────────────┐
│  Client (Browser)                                             │
│  Next.js App Router + React 19 + Tailwind v4 (Server + CSR)   │
└──────────────┬─────────────────────────┬─────────────────────┘
               │                         │
         [HTTP/HTTPS]              [Session cookie]
               │                         │
┌──────────────▼─────────────────────────▼─────────────────────┐
│  Next.js server (Vercel)                                      │
│  ├─ Server Components → Prisma → PostgreSQL                   │
│  ├─ Route Handlers (/api/*) → services → Prisma               │
│  ├─ Cron: /api/cron/send-emails (every 1 min)                 │
│  └─ Attachment proxy → Supabase Storage                       │
└──────────────┬─────────────────────────┬─────────────────────┘
               │                         │
┌──────────────▼───────────────┐  ┌──────▼─────────────────────┐
│  Supabase Postgres           │  │  Gmail SMTP (nodemailer)    │
│  ├─ Pooled (6543)  for app   │  │  (via EmailOutbox)          │
│  ├─ Direct (5432)  for mig   │  └─────────────────────────────┘
│  └─ Storage bucket "attach"  │
└──────────────────────────────┘
```

### 2.2 Tech Stack (ล็อก version)

| Layer | Library | Version | หมายเหตุ |
|---|---|---|---|
| Runtime | Node.js | ≥ 20 | สำหรับ `node:crypto` scrypt |
| Framework | Next.js | 16.3.7 | App Router |
| UI | React | 19.2.8 | Server Components + Client |
| Styling | Tailwind CSS | 4.x | `@theme` tokens |
| Font | Noto Sans Thai | — | `next/font/google` |
| DB client | Prisma | 6.19.3 | TypeScript strict |
| DB | PostgreSQL (Supabase) | 15+ | Supavisor pool |
| Validation | Zod | 4.6.5 | ใช้ schema เดียวทั้ง form + server |
| Email | nodemailer | 10.1.0 | Gmail SMTP via app password |
| Excel export | exceljs | 4.4.0 | fileHandle Buffer เท่านั้น |
| Form | react-hook-form | 7.89.0 | + `@hookform/resolvers` zod |
| Charts | recharts | 3.10.1 | dashboard |
| Testing | Vitest | 5.0.3 | unit/integration |
| E2E | Playwright | 1.63.0 | 3 viewports |
| Package mgr | npm | — | commit `package-lock.json` |

**ห้ามใช้:** pnpm, yarn, bun — commit แค่ `package-lock.json`

---

## 3. โครงสร้างโปรเจค

```
pallet-system/
├─ app/                              # Next.js App Router
│  ├─ page.tsx                       # Landing (/)
│  ├─ layout.tsx                     # Root layout (set Thai font)
│  ├─ auth/
│  │  ├─ login/page.tsx
│  │  ├─ register/page.tsx
│  │  ├─ forgot-password/page.tsx
│  │  └─ reset-password/page.tsx
│  ├─ app/                           # Portal (requester/approver/PM/viewer)
│  │  ├─ page.tsx                    # /app home
│  │  ├─ requests/
│  │  │  ├─ page.tsx                 # list
│  │  │  ├─ new/page.tsx             # create form
│  │  │  └─ [id]/page.tsx            # detail + actions
│  │  ├─ approvals/
│  │  │  ├─ page.tsx                 # queue
│  │  │  └─ history/page.tsx
│  │  ├─ balance/page.tsx            # warehouse balance (view)
│  │  ├─ dashboard/page.tsx          # mini dashboard
│  │  └─ warehouse-ops/page.tsx      # REPAIR + WRITE_OFF (PM only)
│  ├─ manage/                        # Admin console
│  │  ├─ page.tsx                    # dashboard + export
│  │  ├─ requests/, requests/[id]/
│  │  ├─ users/, departments/
│  │  ├─ pallet-types/
│  │  ├─ approval-routes/
│  │  ├─ operating-hours/
│  │  ├─ adjustments/
│  │  └─ audit-logs/
│  └─ api/
│     ├─ auth/            # login, me, register, logout, forgot-password, reset-password
│     ├─ requests/        # CRUD + approve/reject/edit-approve/warnings/attachments
│     ├─ warehouse-ops/   # repair, write-off, summary
│     ├─ adjustments/     # ADJUSTMENT op
│     ├─ departments/, sections/, pallet-types/, users/[id]/
│     ├─ approval-routes/
│     ├─ operating-hours/ (+ /holidays)
│     ├─ balances/
│     ├─ notifications/   (+ /mark-read)
│     ├─ attachments/[id]/view-url
│     ├─ dashboard/export
│     ├─ cron/send-emails
│     └─ health
├─ lib/
│  ├─ auth/               # session.ts, password.ts, current-user.ts, cookie-name.ts
│  ├─ server/
│  │  └─ stock/index.ts   # moveStock() — single entry for stock change
│  ├─ services/           # business logic
│  │  ├─ request.ts, approval-route.ts
│  │  ├─ warehouse.ts, operating-hours.ts
│  │  ├─ notification.ts, email-outbox.ts, send-email.ts
│  │  ├─ attachment.ts, audit.ts, dashboard.ts, export.ts
│  │  └─ docno.ts
│  ├─ http/               # respond.ts (ok/fail helpers)
│  └─ prisma.ts           # singleton PrismaClient
├─ prisma/
│  ├─ schema.prisma       # SINGLE source of truth for DB schema
│  ├─ migrations/
│  └─ seed.ts
├─ scripts/
│  └─ create-admin.ts
├─ tests/                 # vitest (*.test.ts)
├─ docs/                  # SPEC, REQUIREMENTS, ER_DIAGRAM
├─ public/
├─ .env.example           # ตัวอย่าง env vars
├─ vercel.json            # cron config (if any)
├─ CLAUDE.md              # working rules
└─ README.md
```

---

## 4. Data Model

ดูรายละเอียดเต็มที่ [`ER_DIAGRAM.md`](./ER_DIAGRAM.md) — ส่วนนี้สรุปจุดสำคัญ

### 4.1 Entity สรุป

**Users & Org:** `User`, `Department`, `DepartmentSection`
**Master data:** `PalletType`
**Stock:** `WarehouseStock` (snapshot), `DepartmentStock` (snapshot), `StockMovement` (ledger)
**Approval:** `ApprovalRoute`, `ApprovalStep`, `Approval`, `RequestRevision`
**Request:** `Request`, `RequestItem`, `RequestAttachment`
**Warehouse ops:** `WarehouseOperation`, `WarehouseOperationItem`
**Config:** `OperatingHours`, `HolidayDate`
**Notification:** `Notification`, `EmailOutbox`
**Auth:** `PasswordResetToken`
**Observability:** `AuditLog`, `DocCounter`

### 4.2 Enums (ค่าแน่นอน)

```prisma
enum UserRole        { REQUESTER DEPT_APPROVER PALLET_MANAGER VIEWER ADMIN }
enum UserStatus      { PENDING ACTIVE DISABLED }
enum PalletCondition { GOOD PENDING_REPAIR DAMAGED }
enum RequestType     { ISSUE RETURN }
enum RequestStatus   { DRAFT PENDING_DEPT PENDING_WAREHOUSE COMPLETED REJECTED CANCELLED }
enum ApprovalDecision { APPROVED REJECTED EDIT_APPROVED }
enum WarehouseOpType { REPAIR_RESULT WRITE_OFF ADJUSTMENT }
enum EmailStatus     { PENDING SENT FAILED }
```

### 4.3 Key constraints

- `User.email` unique
- `PalletType.name` unique
- `Request.docNo` unique
- `WarehouseOperation.docNo` unique
- `WarehouseStock` composite PK = `(palletTypeId, condition)`
- `DepartmentStock` composite PK = `(palletTypeId, condition, departmentId)`
- `ApprovalRoute` unique `(departmentId, requestType)`
- `ApprovalStep` unique `(routeId, stepOrder)`
- `PasswordResetToken.tokenHash` unique
- `DocCounter.key` PK

### 4.4 Append-only tables (ห้ามเขียน update/delete)
`StockMovement`, `Approval`, `RequestRevision`, `AuditLog`, `WarehouseOperation`

### 4.5 Soft-delete tables (ใช้ `active`/`isActive`)
`Department`, `DepartmentSection`, `PalletType`, `ApprovalRoute`, `ApprovalStep` (via route), `OperatingHours`, `HolidayDate`

### 4.6 Snapshot fields
- `Request.stepSnapshot: Json` = `[{stepOrder, name, approverIds}]` ณ เวลา submit
- `Request.fromSectionId / toSectionId` = snapshot ของ `user.sectionId` ที่ตอนสร้าง
- `RequestRevision.before / after: Json` = snapshot ของ items ก่อน/หลังแก้

---

## 5. Authentication & Authorization

### 5.1 Password hashing

**Algorithm:** scrypt (จาก `node:crypto`) — ไม่ใช้ bcrypt/argon2
**Format:** `scrypt$<saltHex>$<hashHex>`
**Parameters:**
- `saltLength` = 16 bytes
- `keyLength` = 64 bytes
- Default N/r/p

**ไฟล์:** `lib/auth/password.ts`

```ts
export async function hashPassword(plain: string): Promise<string>
export async function verifyPassword(plain: string, stored: string): Promise<boolean>
```

**Validation:** รหัสผ่านต้อง ≥ 8 ตัวอักษร

### 5.2 Session cookie

**Format:** `<base64url(JSON payload)>.<base64url(HMAC-SHA256)>`
**Payload:** `{ uid: string, exp: number /* unix seconds */ }`
**Signing key:** `process.env.SESSION_SECRET` (≥ 16 chars)
**TTL:** 30 วัน
**Cookie flags:**
- `httpOnly: true`
- `secure: NODE_ENV === "production"`
- `sameSite: "lax"`
- `path: "/"`

**Cookie name:** จาก `lib/auth/cookie-name.ts` (export `SESSION_COOKIE_NAME`)

**ไฟล์:** `lib/auth/session.ts` — `encodeSession / decodeSession / setSessionCookie / readSession / clearSessionCookie`

### 5.3 Session helpers

```ts
// lib/auth/current-user.ts
getCurrentUser(): Promise<User | null>          // null ถ้า user.status !== ACTIVE
getSessionUserAnyStatus(): Promise<User | null> // สำหรับหน้า PENDING/DISABLED
requireUser(): Promise<User>                    // throw HttpError(401)
requireRole(...roles): Promise<User>            // throw HttpError(403)
class HttpError(status, message)
```

### 5.4 Login flow

1. POST `/api/auth/login` → body `{email, password}`
2. Service:
   - Query user by email
   - ถ้า `lockedUntil > now` → 429
   - `verifyPassword` → ถ้าผิด: `failedLoginAttempts++`, ถ้า ≥ 5 → `lockedUntil = now + 15min`
   - ถ้าผ่าน: reset counter, `setSessionCookie(user.id)`
   - **ไม่บล็อก** user ที่ `status = PENDING/DISABLED` ตอน login — บล็อกที่ `requireUser()` แทน (เพื่อให้เห็นหน้า "รอการอนุมัติ")
3. Return `{ok: true, user: {id, email, fullName, roles, status, department}}`

### 5.5 RBAC

- Server-side ทุก route ที่เป็น mutation → `requireRole()` หรือ check `user.roles` ภายใน service
- Client-side: hide ปุ่ม/เมนู ด้วย `user.roles` (เพื่อ UX เท่านั้น — ห้ามพึ่งเพียงอย่างเดียว)
- Service-level checks:
  - `createRequest` → ต้องมี `REQUESTER` หรือ `ADMIN`
  - `approveRequest` → ต้องมี `DEPT_APPROVER` / `PALLET_MANAGER` / `ADMIN`
  - `repairPallets` / `writeOffPallets` → ต้องมี `PALLET_MANAGER` / `ADMIN`
  - `adjustStock` → ต้องมี `ADMIN` เท่านั้น
  - `upsertRoute`, operating-hours CRUD, user management → `ADMIN` เท่านั้น

### 5.6 Password reset

1. POST `/api/auth/forgot-password` → body `{email}`
2. ถ้ามี user: สร้าง `PasswordResetToken`
   - `tokenHash` = SHA-256 ของ random 32 bytes (base64url)
   - `expiresAt` = now + 30 นาที
   - `usedAt = null`
   - Email ส่งลิงก์พร้อม raw token
3. ตอบ 200 เสมอ (ไม่เปิดเผยว่า email มีในระบบ)
4. POST `/api/auth/reset-password` → body `{token, newPassword}`
   - Hash token, lookup `PasswordResetToken` ที่ `expiresAt > now` และ `usedAt = null`
   - Update `user.passwordHash`, mark `usedAt = now`

---

## 6. State Machine ของคำขอ

### 6.1 สถานะและ transitions

```
┌──────────┐
│  DRAFT*  │  (ไม่ใช้ใน UI ปัจจุบัน — submit ทันที)
└────┬─────┘
     │ submit
     ▼
┌──────────────┐     approve step N (dept)      ┌────────────────────┐
│ PENDING_DEPT │────────────────────────────────▶│ PENDING_WAREHOUSE  │
└──┬───┬───────┘                                └──┬───┬─────────────┘
   │   │ reject                                   │   │ reject
   │   │                                          │   │
   │   │                                          │   │ approve
   │   │           cancel (requester, no          │   │ or edit-approve
   │   │           approvals yet)                 │   │
   │   ▼                                          │   ▼
   │ ┌─────────┐                                  │ ┌───────────┐
   │ │CANCELLED│                                  │ │ COMPLETED │
   │ └─────────┘                                  │ └───────────┘
   │                                              │
   ▼                                              ▼
┌──────────┐                                    ┌──────────┐
│ REJECTED │                                    │ REJECTED │
└──────────┘                                    └──────────┘
```

### 6.2 Transition rules

| From | Action | To | ผู้ทำ | ผลข้างเคียง |
|---|---|---|---|---|
| (new) | `createRequest` + has route | `PENDING_DEPT`, `currentStepOrder=1` | REQUESTER / ADMIN | snapshot route, notify step 1 |
| (new) | `createRequest` + no route | `PENDING_WAREHOUSE`, `currentStepOrder=null` | — | notify PALLET_MANAGER |
| `PENDING_DEPT` | `approve` by step-N approver | `PENDING_DEPT` (next step) or `PENDING_WAREHOUSE` | DEPT_APPROVER / ADMIN | create Approval record, notify next approvers |
| `PENDING_DEPT` | `reject` | `REJECTED` | DEPT_APPROVER / ADMIN | notify requester |
| `PENDING_DEPT` | `cancel` (no approval yet) | `CANCELLED` | REQUESTER (self) / ADMIN | — |
| `PENDING_WAREHOUSE` | `approve` | `COMPLETED` | PALLET_MANAGER / ADMIN | **moveStock() ครบทุก item**, create Approval, notify requester |
| `PENDING_WAREHOUSE` | `edit-approve` | `COMPLETED` | PALLET_MANAGER / ADMIN | delete+recreate items, create `RequestRevision`, moveStock ตามค่าใหม่ |
| `PENDING_WAREHOUSE` | `reject` | `REJECTED` | PALLET_MANAGER / ADMIN | notify requester |

### 6.3 Edge cases

- **requesterId === approverId** → `approveRequest` throw 400 (บังคับที่ service)
- **user อนุมัติ step เดียวซ้ำ** → `approveRequest` throw 400 (ตรวจ `Approval(step, approverId)` ซ้ำ)
- **อนุมัติ step ที่ไม่ได้อยู่ในกลุ่ม** → `findActableStep()` return null → throw 403 (ยกเว้น ADMIN bypass)
- **ยอดคลังไม่พอตอน PENDING_WAREHOUSE approve** → `moveStock()` throw 400 → status ไม่เปลี่ยน
- **cancel หลังมี approval แล้ว** → ห้าม (ยกเว้น ADMIN)

---

## 7. Core Business Logic

### 7.1 `moveStock()` — single entry สำหรับทุกการเปลี่ยนยอดคลัง

**ไฟล์:** `lib/server/stock/index.ts`

```ts
export interface MoveStockParams {
  palletTypeId: string;
  condition: PalletCondition;
  delta: number;              // +inflow, -outflow (ต่อคลัง)
  fromDepartmentId?: string | null;
  toDepartmentId?: string | null;
  fromSectionId?: string | null;
  toSectionId?: string | null;
  reason?: string | null;
  requestId?: string | null;
  warehouseOpId?: string | null;
  movementGroupId?: string;   // สำหรับ multi-movement operation (เช่น REPAIR)
  occurredAt?: Date;
}

export async function moveStock(tx: TxClient, p: MoveStockParams): Promise<void>
```

**ขั้นตอน (ทั้งหมดใน `prisma.$transaction`):**

1. **สร้าง `StockMovement`** — append-only ledger (`quantity = Math.abs(delta)`)
2. **อัปเดต `WarehouseStock` snapshot:**
   - `delta > 0` (inflow): `INSERT ... ON CONFLICT DO UPDATE SET quantity = quantity + delta`
   - `delta < 0` (outflow): **conditional UPDATE** — update เฉพาะเมื่อ `quantity >= abs(delta)` ถ้า `rowsAffected = 0` → throw `HttpError(400, "ยอด ... ไม่พอ")`
3. **อัปเดต `DepartmentStock` snapshot** (ถ้ามี from/toDepartmentId):
   - `toDepartmentId` → +qty
   - `fromDepartmentId` → -qty
   - **ไม่ตรวจติดลบ** (BR-3)

### 7.2 `createRequest()`

**ไฟล์:** `lib/services/request.ts`

**ขั้นตอน:**
1. ตรวจ role: `REQUESTER` หรือ `ADMIN`
2. ตรวจ items: ต้องมีอย่างน้อย 1, quantity > 0 ทุก item
3. ตรวจประเภทพาเลททุก item ว่า `active = true`
4. หา warehouse department (`isWarehouse: true, active: true`) ถ้าไม่มี → 500
5. ถ้า `type = RETURN` ต้องมี `condition`
6. **Auto-fill from/to:**
   - `ISSUE`: from = warehouse, to = `user.department / user.section`
   - `RETURN`: from = `user.department / user.section`, to = warehouse
7. ตรวจ `user.departmentId` ว่ามี (ไม่งั้น 400)
8. **BR-2 warning**: ถ้า `type = ISSUE` → ตรวจ `getAvailableBalance()` ของทุก (palletType) ถ้าไม่พอ → เพิ่มใน `warnings[]` (ไม่บล็อก)
9. **Operating hours check**: `checkOperatingHours()` → ถ้าปิด → throw 400 พร้อมเวลาเปิดถัดไป
10. Resolve approval route:
    - ถ้า `type ∈ ROUTABLE` และ `user.departmentId`:
      - `resolveRoute(departmentId, type)` → ถ้า route = empty → `PENDING_WAREHOUSE` (เฉพาะกรณีไม่มี step; ปัจจุบัน resolve throw ถ้าไม่มี route — คอนเฟิร์มว่าแผนกต้องตั้ง route ก่อน)
      - ถ้ามี steps → `PENDING_DEPT`, `currentStepOrder = 1`
11. ใน `prisma.$transaction`:
    - `nextDocNo(type)` → create `Request` พร้อม items + stepSnapshot
12. `writeAudit(entity: "request", action: "create")`
13. Return `{...request, warnings}`

### 7.3 `getAvailableBalance()`

```
available = WarehouseStock.quantity − SUM(RequestItem.quantity)
            where request.status IN (PENDING_DEPT, PENDING_WAREHOUSE)
              AND request.type = ISSUE
              AND request.fromDepartmentId = warehouse
              AND request.condition = X
              AND request_item.palletTypeId = Y
```

### 7.4 `approveRequest()`

**ขั้นตอน:**
1. ตรวจ role และ requester ≠ approver
2. ตรวจ status ∈ {`PENDING_DEPT`, `PENDING_WAREHOUSE`}
3. หา `actingStep`:
   - `PENDING_DEPT`: `findActableStep(snapshot, currentStepOrder, user.id)` → ถ้า null และไม่ใช่ ADMIN → 403
   - `PENDING_WAREHOUSE`: step = `snapshot.length + 1`, name = "คลังพาเลท"
4. ตรวจซ้ำ: ถ้าเคย approve step นี้แล้ว → 400
5. ใน transaction:
   - สร้าง `Approval(decision=APPROVED, step, stepName, comment, decidedAt)`
   - ถ้า **final step**:
     - `moveStock()` ทุก item (delta = `type === ISSUE ? -qty : +qty`)
     - Queue email แจ้ง requester (ภายใน tx — ใช้ `queueEmail(tx, ...)`)
     - Update: status = `COMPLETED`, `completedAt`, `currentStepOrder = null`
   - ถ้ามี next step → status = `PENDING_DEPT`, `currentStepOrder = next`
   - ถ้าไม่มี next → status = `PENDING_WAREHOUSE`, `currentStepOrder = null`
6. `writeAudit(action: "approve")`
7. (นอก transaction) `notifyApproversOfNewRequest(id)` เพื่อแจ้งขั้นถัดไป (ถ้าเปลี่ยนสถานะ)

### 7.5 `rejectRequest()`

- Comment บังคับ (trim ไม่เป็นว่าง)
- ตรวจ status ∈ {`PENDING_DEPT`, `PENDING_WAREHOUSE`}
- ตรวจ requester ≠ approver
- Transaction:
  - Update: status = `REJECTED`, `currentStepOrder = null`
  - Create `Approval(decision=REJECTED, comment, step, stepName)`
- `notifyRequestRejected(id, comment)`
- `writeAudit(action: "reject")`

### 7.6 `editAndApprove()` — Pallet Manager only

- ตรวจ role: `PALLET_MANAGER` หรือ `ADMIN`
- ตรวจ status = `PENDING_WAREHOUSE` เท่านั้น
- `reason` บังคับ, `items` อย่างน้อย 1
- Transaction:
  - `deleteMany({requestId})` → `createMany(newItems)`
  - Create `RequestRevision(before={items: old}, after={items: new}, reason)`
  - `moveStock()` ทุก new item (ใช้ `item.condition` หรือ fallback `request.condition`)
  - Create `Approval(decision=APPROVED, stepName="คลังพาเลท (แก้ไข)")`
  - Queue email แจ้ง requester
  - Update: status = `COMPLETED`, `completedAt`
- `writeAudit(action: "edit_approve")`

### 7.7 `cancelRequest()`

- ถ้า requester = user: ตรวจไม่มี Approval record แล้ว
- ถ้าเป็น ADMIN: ข้ามข้อนี้
- Update: status = `CANCELLED`, `cancelledAt`
- `writeAudit(action: "cancel")`

### 7.8 `repairPallets()` — Pallet Manager

**Input:** `{palletTypeId, repairedQty, damagedQty, note?}`
**Logic:**
- `total = repaired + damaged` ต้อง > 0
- ทั้งสองค่า ≥ 0
- Transaction:
  - สร้าง `WarehouseOperation(type=REPAIR_RESULT, docNo, reason)`
  - `moveStock(condition=PENDING_REPAIR, delta=-total, from=warehouse)` ← ถ้าไม่พอ throw
  - ถ้า `repairedQty > 0`: `moveStock(condition=GOOD, delta=+repaired, to=warehouse)`
  - ถ้า `damagedQty > 0`: `moveStock(condition=DAMAGED, delta=+damaged, to=warehouse)`
  - ทั้ง 3 movements ใช้ `movementGroupId = operation.id`
- `writeAudit(action: "repair")`

### 7.9 `writeOffPallets()` — Pallet Manager

**Input:** `{palletTypeId, condition, quantity, note}` — `note` บังคับ
**Logic:**
- Transaction:
  - สร้าง `WarehouseOperation(type=WRITE_OFF)`
  - `moveStock(condition, delta=-qty, from=warehouse)`
- `writeAudit(action: "write_off")`

### 7.10 `adjustStock()` — Admin only

**Input:** `{palletTypeId, condition, fromDepartmentId?, toDepartmentId?, quantity, reason}` — `reason` บังคับ
**Logic:**
- `quantity > 0`
- `from` หรือ `to` อย่างน้อย 1 ต้องมี; ถ้ามีทั้งคู่ ห้ามเท่ากัน
- ด้านใดด้านหนึ่งต้องเป็น warehouse (เช่น `to = warehouse` คือ "รับเข้าใหม่")
- `delta = warehouseReceives ? +qty : -qty`
- Transaction:
  - สร้าง `WarehouseOperation(type=ADJUSTMENT, reason)`
  - `moveStock(delta, fromDeptId, toDeptId)` — ใช้ `warehouseOpId` + `movementGroupId` = `operation.id`

### 7.11 `resolveRoute()`

- ค้น `ApprovalRoute(departmentId, requestType, isActive: true)` + steps ordered by `stepOrder`
- ถ้าไม่พบ → throw `400 "แผนก X ยังไม่ได้กำหนด approval route สำหรับ Y"`
- Return `[{stepOrder, name, approverIds}]`

### 7.12 `upsertRoute()` — Admin

- ตรวจ `requestType ∈ {ISSUE, RETURN}` (ROUTABLE)
- Steps อย่างน้อย 1, ไม่เกิน 10
- `stepOrder` ต้องเรียงต่อกันจาก 1
- Step name ต้องไม่ว่างหลัง trim
- `approverIds` อย่างน้อย 1
- ตรวจ approver ทุกคนต้อง: `status = ACTIVE` + มี role `DEPT_APPROVER`
- ตรวจ `(departmentId, requestType)` ไม่ซ้ำ (ลบของเดิมก่อน หรือ update ตาม id)
- Transaction: delete old steps → create new steps

### 7.13 `checkApproverRouteConflict()`

- ก่อนที่ admin disable user ที่เป็น approver → ตรวจว่าถ้าถอด user นี้จาก steps ที่เขาอยู่เป็นคนเดียว → step นั้นจะว่าง
- Return error message พร้อม list หรือ null

---

## 8. API Contract

ทุก endpoint:
- `Content-Type: application/json` (ยกเว้น attachments = `multipart/form-data`)
- Return format standard:
  ```json
  // success
  { "ok": true, "data": { ... } }
  // error
  { "ok": false, "error": "message", "status": 400 }
  ```
- Auth: HTTP-only cookie `__session` (อ่านโดย `getCurrentUser()`)

### 8.1 Auth

| Method | Path | Role | Body | Response |
|---|---|---|---|---|
| POST | `/api/auth/login` | public | `{email, password}` | `{user}` + Set-Cookie |
| GET | `/api/auth/me` | any session | — | `{user, needsRegistration?, status}` |
| POST | `/api/auth/register` | public | `{email, password, fullName, phone?, departmentId, sectionId?}` | `{ok: true}` |
| POST | `/api/auth/logout` | any | — | `{ok: true}` + clear cookie |
| GET | `/api/auth/logout-and-redirect` | any | — | 302 redirect |
| POST | `/api/auth/forgot-password` | public | `{email}` | `{ok: true}` (ไม่เปิดเผย existence) |
| POST | `/api/auth/reset-password` | public | `{token, newPassword}` | `{ok: true}` |
| GET | `/api/auth/dev-users` | **dev-only** | — | `[{email, hint}]` |
| GET | `/api/auth/dev-login?userId=...` | **dev-only** | — | set cookie |

### 8.2 Requests

| Method | Path | Role | Body |
|---|---|---|---|
| GET | `/api/requests?scope=mine\|to-approve\|i-approved&status=...&type=...` | authenticated | — |
| POST | `/api/requests` | REQUESTER/ADMIN | `CreateRequestInput` |
| GET | `/api/requests/[id]` | authenticated | — |
| PATCH | `/api/requests/[id]` | ADMIN | `Partial<Request>` |
| DELETE | `/api/requests/[id]` | requester/ADMIN | — (cancel) |
| GET | `/api/requests/[id]/warnings` | authenticated | — |
| POST | `/api/requests/[id]/approve` | APPROVER/PM/ADMIN | `{comment?}` |
| POST | `/api/requests/[id]/reject` | APPROVER/PM/ADMIN | `{comment}` |
| POST | `/api/requests/[id]/edit-approve` | PM/ADMIN | `{items[], reason, comment?}` |
| POST | `/api/requests/[id]/attachments` | authenticated | `FormData` with files |

### 8.3 Warehouse ops

| Method | Path | Role | Body |
|---|---|---|---|
| POST | `/api/warehouse-ops/repair` | PM/ADMIN | `{palletTypeId, repairedQty, damagedQty, note?}` |
| POST | `/api/warehouse-ops/write-off` | PM/ADMIN | `{palletTypeId, condition, quantity, note}` |
| GET | `/api/warehouse-ops/summary` | authenticated | — |
| POST | `/api/adjustments` | ADMIN | `{palletTypeId, condition, fromDepartmentId?, toDepartmentId?, quantity, reason}` |

### 8.4 Master data (Admin)

| Method | Path | Role |
|---|---|---|
| GET/POST | `/api/departments` | GET: auth, POST: ADMIN |
| PATCH/DELETE | `/api/departments/[id]` | ADMIN |
| GET/POST | `/api/sections?departmentId=...` | GET: auth, POST: ADMIN |
| PATCH/DELETE | `/api/sections/[id]` | ADMIN |
| GET/POST | `/api/pallet-types` | GET: auth, POST: ADMIN |
| PATCH/DELETE | `/api/pallet-types/[id]` | ADMIN |
| PATCH | `/api/users/[id]` | ADMIN |
| GET/POST | `/api/approval-routes` | ADMIN |
| GET/PATCH/DELETE | `/api/approval-routes/[id]` | ADMIN |
| GET/POST | `/api/operating-hours` | GET: auth, POST: ADMIN |
| PATCH/DELETE | `/api/operating-hours/[id]` | ADMIN |
| GET/POST | `/api/operating-hours/holidays` | GET: auth, POST: ADMIN |
| DELETE | `/api/operating-hours/holidays/[id]` | ADMIN |

### 8.5 Reads

| Method | Path | Role |
|---|---|---|
| GET | `/api/balances` | authenticated |
| GET | `/api/notifications` | authenticated |
| PATCH | `/api/notifications/mark-read` | authenticated |
| GET | `/api/attachments/[id]/view-url` | authenticated |
| GET | `/api/dashboard/export?from=...&to=...&...` | authenticated (returns .xlsx) |
| GET | `/api/health` | public |
| GET | `/api/cron/send-emails` | header `Authorization: Bearer <CRON_SECRET>` |

---

## 9. Validation (Zod)

ใช้ Zod schema **เดียวกัน** ทั้ง form (react-hook-form + zodResolver) และ server (route handler)

### 9.1 `CreateRequestInput`

```ts
const CreateRequestInput = z.object({
  type: z.enum(["ISSUE", "RETURN"]),
  condition: z.enum(["GOOD", "PENDING_REPAIR", "DAMAGED"]).optional().nullable(),
  fromDepartmentId: z.string().optional().nullable(),
  fromSectionId: z.string().optional().nullable(),
  toDepartmentId: z.string().optional().nullable(),
  toSectionId: z.string().optional().nullable(),
  neededDate: z.coerce.date().optional().nullable(),
  purpose: z.string().max(500).optional().nullable(),
  note: z.string().max(1000).optional().nullable(),
  items: z.array(z.object({
    palletTypeId: z.string(),
    quantity: z.coerce.number().int().positive(),
    note: z.string().max(200).optional().nullable()
  })).min(1)
})
.superRefine((d, ctx) => {
  if (d.type === "RETURN" && !d.condition) {
    ctx.addIssue({code: "custom", path: ["condition"], message: "ต้องระบุสภาพพาเลทสำหรับการคืน"});
  }
});
```

### 9.2 `RegisterInput`

```ts
const RegisterInput = z.object({
  email: z.string().email(),
  password: z.string().min(8, "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร"),
  fullName: z.string().min(1).max(100),
  phone: z.string().max(20).optional(),
  departmentId: z.string(),
  sectionId: z.string().optional().nullable()
});
```

### 9.3 `UpsertRouteInput`

```ts
const UpsertRouteInput = z.object({
  id: z.string().optional(),
  departmentId: z.string(),
  requestType: z.enum(["ISSUE", "RETURN"]),
  steps: z.array(z.object({
    stepOrder: z.number().int().positive(),
    name: z.string().min(1).max(100),
    approverIds: z.array(z.string()).min(1)
  })).min(1).max(10)
});
```

### 9.4 `OperatingHoursInput`

```ts
const HoursInput = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  label: z.string().max(50).optional().nullable()
});
```

### 9.5 ที่อื่น ๆ
- `AdjustmentInput`: palletTypeId, condition, quantity ≥ 1, reason min 1 char
- `RepairInput`: repaired/damaged ≥ 0, total > 0
- `WriteOffInput`: quantity ≥ 1, note ≥ 1 char

---

## 10. Operating Hours & Timezone

### 10.1 Timezone
- ใช้ **Asia/Bangkok** ทุกการตรวจเวลา และ format display
- Backend: `nowBangkok()` ใน `lib/services/operating-hours.ts` ใช้ `Intl.DateTimeFormat('en-US', {timeZone: 'Asia/Bangkok', hourCycle: 'h23'})`
- Return: `{dayOfWeek: 0..6, time: "HH:MM", dateStr: "YYYY-MM-DD"}`

### 10.2 `checkOperatingHours()`

**Algorithm:**
1. `nowBangkok()` → `{dayOfWeek, time, dateStr}`
2. ตรวจ `HolidayDate.date = bkkToday`, `isActive = true` → ถ้ามี → closed
3. Query `OperatingHours.findMany({dayOfWeek, isActive: true})`
4. วน slot: ถ้า `currentMin >= startMin && currentMin < endMin` → open
5. ถ้าปิด: หา `later = hours.find(h => startMin > currentMin)` → `nextOpenAt = "HH:MM น."`
6. ถ้าไม่มี later วันนี้ → `nextOpenAt = "วันทำการถัดไป"`

### 10.3 Overlap prevention
`createOperatingHours` / `updateOperatingHours` → `assertNoOverlap()` คำนวณ `[start, end)` overlap vs. siblings ของ `dayOfWeek` เดียวกัน (`isActive`)

### 10.4 ความสำคัญ
- ตรวจ **ที่ server เท่านั้น** — ไม่พึ่ง client clock
- ตรวจตอน **submit คำขอ** เท่านั้น (BR-10) — ไม่ตรวจตอน approve

---

## 11. เลขเอกสาร (Doc Number)

### 11.1 Format
```
Request:            PL-<CODE>-<YYMM>-<SEQ>  — CODE ∈ {ISS, RET}
Warehouse Op:       WO-<CODE>-<YYMM>-<SEQ>  — CODE ∈ {REP, WOF, ADJ}
```
- `YYMM` = ปี 2 หลัก + เดือน 2 หลัก (เช่น ตุลาคม 2026 = `2610`)
- `SEQ` = running counter ต่อเดือน + prefix, zero-padded 4 หลัก

### 11.2 Atomic increment
ใช้ raw SQL `INSERT ... ON CONFLICT DO UPDATE RETURNING seq` บนตาราง `doc_counters(key, seq, updatedAt)` → race-free

**Key format:** `<CODE>-<YYMM>` (เช่น `ISS-2610`, `WO-REP-2610`)

### 11.3 Implementation
`lib/services/docno.ts`:
```ts
nextDocNo(type: RequestType, at?: Date, tx?: TxClient): Promise<string>
nextWarehouseOpDocNo(type: WarehouseOpType, at?: Date): Promise<string>
```

---

## 12. การแจ้งเตือนและ Email Outbox

### 12.1 ช่องทาง
- **In-app**: `Notification` table — write ใน service
- **Email**: outbox pattern — write `EmailOutbox` ใน `prisma.$transaction` ของ action; ส่งโดย cron

### 12.2 EmailOutbox fields

```prisma
model EmailOutbox {
  id        String      @id @default(cuid())
  to        String
  subject   String
  bodyHtml  String
  status    EmailStatus @default(PENDING)
  attempts  Int         @default(0)
  lastError String?
  createdAt DateTime    @default(now())
  sentAt    DateTime?
}
```

### 12.3 Cron processor

`/api/cron/send-emails` (`app/api/cron/send-emails/route.ts`):
1. ตรวจ `Authorization: Bearer <CRON_SECRET>` (ถ้า env ตั้ง)
2. เรียก `processEmailOutbox(batchSize = 20)` จาก `lib/services/send-email.ts`
3. Process:
   - Query `EmailOutbox` where `status = PENDING` order by `createdAt asc` take 20
   - สำหรับแต่ละ email:
     - `transporter.sendMail(from, to, subject, html)` ผ่าน nodemailer Gmail SMTP
     - ถ้าสำเร็จ: update `status = SENT, sentAt = now, attempts++`
     - ถ้าเฟล: update `status = FAILED, lastError, attempts++`
4. Return `{sent, failed}`

### 12.4 Trigger table

| Event | Trigger function | Recipients |
|---|---|---|
| register | `notifyNewUserToAdmins(userId)` | admins + confirm → user |
| user approved/rejected by admin | `notifyUserApprovalResult(userId, approved)` | user |
| new request → PENDING_DEPT step N | `notifyApproversOfNewRequest(id)` | approvers ของ step นั้น |
| new request → PENDING_WAREHOUSE | `notifyApproversOfNewRequest(id)` | PALLET_MANAGER ทุกคน |
| request COMPLETED | queue inside approve tx + `notifyRequestCompleted` | requester |
| request REJECTED | `notifyRequestRejected(id, comment)` | requester |
| edit-approve | queue inside tx + `notifyEditApproved` | requester |

### 12.5 Email templates
`lib/services/email-outbox.ts`:
- `buildRequestEmail({title, docNo, typeLabel, requesterName, departmentName, itemsSummary, statusText, comment?, appUrl, requestId})` → HTML
- `buildUserEmail({title, bodyLines[], ctaText?, ctaUrl?, summaryRows?})` → HTML
- ภาษาไทย + ลิงก์กลับไป `${APP_URL}/app/requests/${id}` หรือ `${APP_URL}/manage/users`

### 12.6 SMTP config
Env vars:
- `GMAIL_USER` — Gmail address ที่ใช้ส่ง
- `GMAIL_APP_PASSWORD` — Google App Password (ไม่ใช่ password ปกติ)
- `APP_URL` — base URL สำหรับลิงก์ใน email

From header: `Noritake Pallet <${GMAIL_USER}>`

### 12.7 Vercel Cron limitation
Vercel Hobby plan จำกัด cron แค่ **1/day** → ปัจจุบันต้องเลือก:
- (ก) Upgrade เป็น Pro
- (ข) ใช้ **external cron** เช่น GitHub Actions / Supabase pg_cron / cron-job.org ยิง `/api/cron/send-emails` ด้วย Bearer token ทุก 1 นาที
- (ค) Fire-and-forget trigger หลัง queue outbox (reduce latency) + external cron เป็น safety net

---

## 13. Attachments (Supabase Storage)

### 13.1 Upload
`POST /api/requests/[id]/attachments` — `multipart/form-data` with field `files[]`

**ขั้นตอน:**
1. ตรวจ user ∈ requester หรือ admin
2. สำหรับแต่ละ file:
   - Validate: mimeType ∈ `image/jpeg`, `image/png`, `image/webp`
   - sizeBytes ≤ 5 MB
3. Upload ไป Supabase Storage bucket `attachments` ใช้ service role key
   - Path: `request/{requestId}/{uuid}.{ext}`
4. Insert `RequestAttachment(filePath, mimeType, sizeBytes)`

### 13.2 View
`GET /api/attachments/[id]/view-url` → Supabase `createSignedUrl(path, expiresIn: 300)` → 302 redirect หรือ return URL

### 13.3 Delete
ไม่มี (append-only — ถ้าจะลบ ให้ admin ลบจาก Supabase console และ `RequestAttachment` row)

---

## 14. Dashboard & Excel Export

### 14.1 Dashboard metrics

**บน `/manage` (admin):**
- ยอดคลัง: group by `(palletTypeId, condition)` → แสดง matrix
- Movement 30 วัน: ยอดเบิก (sum ของ movements out), ยอดคืน (in), ผลซ่อม (REPAIR_RESULT), ตัดจำหน่าย (WRITE_OFF), ปรับยอด (ADJUSTMENT)
- คำขอรออนุมัติ: count by status + step
- สถิติแยกแผนก: group by `fromDepartmentId / toDepartmentId`
- ผลซ่อม: `WarehouseOperationItem` where `operation.type = REPAIR_RESULT` → อัตราซ่อมได้

### 14.2 Filters
- `from`, `to` (date range)
- `departmentId`, `sectionId`
- `palletTypeId`
- `condition`

### 14.3 Export Excel

`GET /api/dashboard/export?from=&to=&departmentId=&palletTypeId=&condition=`

**Format (exceljs):**
- Multiple sheets: "ยอดในคลัง", "การเคลื่อนไหว", "คำขอ", "ผลซ่อม", "ตัดจำหน่าย"
- Headers ภาษาไทย
- Date cells: `cell.numFmt = 'dd/mm/yyyy hh:mm'`, timezone Asia/Bangkok
- Number cells: ตัวเลขจริง (ไม่ใช่ string)
- Response: `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `Content-Disposition: attachment; filename=dashboard-YYYY-MM-DD.xlsx`

---

## 15. Audit Log

### 15.1 ไฟล์
`lib/services/audit.ts`:
```ts
writeAudit({userId, entity, entityId, action, before?, after?, ipAddress?, userAgent?}): Promise<void>
```

### 15.2 Events ที่ต้อง log

| Entity | Action | เมื่อไร |
|---|---|---|
| `request` | `create` / `cancel` / `approve` / `reject` / `edit_approve` | ทุกครั้ง |
| `warehouse_operation` | `repair` / `write_off` / `adjust` | ทุกครั้ง |
| `user` | `register` / `approve` / `disable` / `enable` / `reset_password` | ทุกครั้ง |
| `department` / `section` / `pallet_type` / `approval_route` | `create` / `update` / `delete` | ทุกครั้ง |

### 15.3 Rules
- **ห้าม** update/delete `AuditLog` row (append-only)
- `before` / `after` เก็บเป็น JSON — ไม่ dump passwordHash
- Audit ต้อง log **หลัง** transaction สำเร็จ (ไม่ล็อก tx)

---

## 16. UI / UX Specification

### 16.1 Styling
- **Tailwind CSS v4** — `@theme` tokens ใน `app/globals.css`
- สี primary: Noritake brand (ปรับตามจริง)
- Font: Noto Sans Thai (ผ่าน `next/font/google`) — `className` apply ที่ `<body>` ใน `app/layout.tsx`
- Breakpoints: ใช้ default Tailwind (`sm` 640, `md` 768, `lg` 1024, `xl` 1280)

### 16.2 Responsive
- ทดสอบที่ 375 / 768 / 1280 px — Playwright E2E ครอบ
- ตารางยาว → เปลี่ยนเป็น card list บนมือถือ
- Form input `type` ต้องตั้งเหมาะสม (`number`, `email`, `tel`, `date`)
- Touch target ≥ 44×44 px บน mobile

### 16.3 Components ที่ต้องมี
- Button (primary / secondary / danger / ghost)
- Input / Textarea / Select / Combobox / Checkbox / Radio / Switch
- Card
- Dialog / AlertDialog
- Tabs
- Toast (notification)
- Table + Pagination
- Skeleton loader
- EmptyState

ไม่บังคับใช้ shadcn/ui — มีก็ได้ ไม่มีก็เขียนเอง แต่ต้อง accessible (keyboard, screen reader)

### 16.4 Form patterns
- react-hook-form + `zodResolver`
- Error message ภาษาไทยใต้ field
- Submit button disabled ขณะ `isSubmitting`
- Server error → แสดงใน toast

### 16.5 Thai labels (ที่ต้องตรงเป๊ะ)

| Element | Label |
|---|---|
| Request type ISSUE | "เบิกออก" |
| Request type RETURN | "คืนเข้า" |
| Condition GOOD | "ดี" |
| Condition PENDING_REPAIR | "รอซ่อม" |
| Condition DAMAGED | "เสีย" |
| Status DRAFT | "ร่าง" |
| Status PENDING_DEPT | "รออนุมัติ (แผนก)" |
| Status PENDING_WAREHOUSE | "รออนุมัติ (คลัง)" |
| Status COMPLETED | "อนุมัติแล้ว" |
| Status REJECTED | "ปฏิเสธแล้ว" |
| Status CANCELLED | "ยกเลิกแล้ว" |
| Action approve | "อนุมัติ" |
| Action reject | "ปฏิเสธ" |
| Action edit-approve | "แก้ไขแล้วอนุมัติ" |
| User status PENDING | "รอการอนุมัติ" |
| User status DISABLED | "ถูกระงับ" |

### 16.6 Error messages (ภาษาไทย)
- `"ยอด GOOD ในคลังไม่พอ (มี X ใบ, ต้องการ Y ใบ)"`
- `"ผู้ร้องขอกับผู้อนุมัติต้องไม่ใช่คนเดียวกัน"`
- `"ขณะนี้อยู่นอกช่วงเวลาทำรายการ (เปิดถัดไป: HH:MM น.)"`
- `"แผนก X ยังไม่ได้กำหนด approval route สำหรับ Y — กรุณาติดต่อ Admin"`
- `"ต้องระบุเหตุผลการปฏิเสธ"`

---

## 17. Business Rules & Invariants

### 17.1 Business Rules (BR)

| # | Rule |
|---|---|
| **BR-1** | ยอดในคลังของทุก (ประเภท × สภาพ) ≥ 0 เสมอ (บังคับโดย conditional UPDATE) |
| **BR-2** | ISSUE: ตรวจยอด 2 จังหวะ — ตอน submit **เตือน** (ไม่บล็อก); ตอน approve step สุดท้าย **บล็อก** |
| **BR-3** | RETURN: ไม่บล็อกคืนเกินยอดเบิกสะสม (DepartmentStock อาจติดลบได้) แต่ **แสดงคำเตือน** |
| **BR-4** | ทุกคำขอ: ≥ 1 item, qty > 0, RETURN ต้อง 1 condition/ใบ |
| **BR-5** | เปลี่ยนยอดต้องเขียน ledger + update snapshot ใน transaction เดียวกัน |
| **BR-6** | Ledger append-only; แก้ยอดต้องผ่าน ADJUSTMENT |
| **BR-7** | WRITE_OFF, ADJUSTMENT ต้องมี reason (ไม่ว่าง) |
| **BR-8** | User status ≠ ACTIVE → เข้าใช้ไม่ได้ |
| **BR-9** | Master data soft-delete เท่านั้นถ้ามีประวัติ |
| **BR-10** | ส่งคำขอได้เฉพาะในช่วงเวลา (ไม่มี urgent ใน v1.0) |

### 17.2 Invariants (ต้องมี test ตรวจ)

| INV | Statement |
|---|---|
| **INV-1** | `WarehouseStock.quantity ≥ 0` เสมอ |
| **INV-2** | `WarehouseStock(pt, cond).quantity = Σ(movements where to=warehouse) − Σ(movements where from=warehouse)` for same `(pt, cond)` |
| **INV-3** | ทุก `StockMovement.quantity > 0` (เก็บ absolute value; ทิศทางอยู่ใน from/to) |
| **INV-4** | `Request.stepSnapshot` immutable หลัง submit (ไม่ update) |
| **INV-5** | `AuditLog` entry ไม่เคยถูก update/delete |
| **INV-6** | `Request.currentStepOrder = null` ⇔ status ∈ {`COMPLETED`, `REJECTED`, `CANCELLED`, `PENDING_WAREHOUSE`} |

---

## 18. Acceptance Criteria

ทุกข้อต้องมี test ครอบ (unit หรือ e2e):

| # | Scenario |
|---|---|
| **AC-1** | คลัง GOOD(A) = 10; alpha ขอเบิก 12 → submit ได้ (มีคำเตือน); PM approve → ล้มเหลว ยอดไม่เปลี่ยน |
| **AC-2** | ผลิตมี route 2 ขั้น; submit → แจ้ง approver step 1 เท่านั้น; approve step 1 → แจ้ง step 2; step 2 approve → `PENDING_WAREHOUSE` + แจ้ง PM |
| **AC-3** | RD route 1 ขั้น; approve 1 ครั้ง → `PENDING_WAREHOUSE` |
| **AC-4** | user ที่ทั้งเป็น requester และ approver — API `/approve` return 400 (ตัวเองไม่ได้) |
| **AC-5** | คืนรอซ่อม A × 5 + B × 3 → `PENDING_REPAIR` A+=5, B+=3; ledger มี 2 row link `fromDepartment = mixer` |
| **AC-6** | แผนก X เบิกสะสม 10 แล้ว submit คืน 50 → submit ได้, แสดงคำเตือน "คืนเกินยอดเบิก 40", approve ได้ |
| **AC-7** | PM edit คำขอ 10 → 8 + reason → create `RequestRevision`, requester ได้รับ email, ยอด +8 |
| **AC-8** | REPAIR_RESULT A: 8 ซ่อมได้ + 2 เสีย → `PENDING_REPAIR` -10, GOOD +8, DAMAGED +2; total เกินยอดรอซ่อม → ล้มเหลว |
| **AC-9** | 2 คำขอเบิก พร้อมกันเกินยอด → สำเร็จแค่ 1 (conditional UPDATE ป้องกัน race) |
| **AC-10** | OperatingHours จ–ส 09:00–11:30 — จันทร์ 10:00 ส่งได้; จันทร์ 12:00 หรือ อาทิตย์ส่งไม่ได้ (บล็อก) |
| **AC-11** | สมัครใหม่ → login ได้แต่เห็น "รอการอนุมัติ"; admin approve → email แจ้งผู้สมัคร |
| **AC-12** | admin แก้ route 2 → 3 ขั้น — คำขอที่ค้างยังใช้ snapshot เดิม (2 ขั้น) |
| **AC-13** | SMTP ล้มเหลว → การ approve ยังสำเร็จ, outbox row = FAILED + `lastError` |
| **AC-14** | WarehouseStock.quantity = sum of ledger — ตรวจทุก `(pt, cond)` ด้วย test |
| **AC-15** | Export Excel: ตัวเลขเป็น Number cell, วันที่ format Bangkok, header ภาษาไทย |
| **AC-16** | Password reset: ลิงก์หมดอายุหลัง 30 นาที, ใช้ได้ครั้งเดียว, token2 ไม่เท่ากับ token1 |
| **AC-17** | Login ผิด 5 ครั้ง → `lockedUntil` set, login ครั้งถัดไป return 429 แม้ password ถูก |

---

## 19. Testing Strategy

### 19.1 Vitest (unit + integration)

**Framework:** Vitest 5.0.3 + Prisma mock หรือ real test DB

**ไฟล์ที่ต้องมี:**
- `tests/stock.test.ts` — moveStock inflow/outflow, conditional update, DepartmentStock
- `tests/ledger-invariant.test.ts` — INV-2
- `tests/approval-flow.test.ts` — multi-step state machine
- `tests/approval-workflow.test.ts` — snapshot immutability, next step resolution
- `tests/warehouse.test.ts` — REPAIR, WRITE_OFF
- `tests/operating-hours.test.ts` — overlap, holiday, Bangkok TZ
- `tests/request-warnings.test.ts` — BR-2 / BR-3
- `tests/regression.test.ts` — edge cases ที่เคยพบ

**Run:**
```bash
npm test                 # one-shot
npm run test:watch
```

### 19.2 Playwright (E2E)

**Setup:** `playwright.config.ts` — projects สำหรับ 375/768/1280

**ครอบ:**
- Login + register + reset password
- Create request flow
- Approve flow (multi-step)
- Admin: manage users, routes, operating hours
- Dashboard + export Excel

**Run:**
```bash
PLAYWRIGHT_BASE_URL=http://localhost:3000 \
E2E_ADMIN_USER=admin@noritake.local \
E2E_ADMIN_PASS=Noritake@2026 \
npm run test:e2e
```

### 19.3 Rules
- เขียน test จาก Acceptance Criteria ก่อน แล้วค่อย implement
- ห้ามแก้ test เพื่อให้ผ่าน (ยกเว้นแก้ bug ใน test เอง)
- CI (ถ้ามี) ต้องรัน `lint && typecheck && test` ผ่านทั้งหมด

---

## 20. Deployment & Environment

### 20.1 Hosting
- **App:** Vercel (Next.js runtime)
- **DB:** Supabase PostgreSQL
- **Storage:** Supabase Storage (bucket: `attachments`)
- **Email:** Gmail SMTP (via App Password) — Phase 2: switch เป็น Resend/SendGrid ถ้า quota ไม่พอ

### 20.2 Environment variables

```bash
# ===== Database (Supabase Postgres) =====
DATABASE_URL=postgresql://...pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
DIRECT_URL=postgresql://...pooler.supabase.com:5432/postgres

# ===== Supabase =====
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# ===== App =====
APP_URL=https://nsp-pallet-system.vercel.app
SESSION_SECRET=<random 32+ chars base64>

# ===== Email (Gmail SMTP) =====
GMAIL_USER=noreply@yourcompany.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx

# ===== Cron =====
CRON_SECRET=<random 32+ chars base64>
```

### 20.3 Build commands

```bash
npm install           # includes postinstall: prisma generate
npm run db:migrate:deploy   # production migration
npm run build         # prisma generate && next build
npm start
```

### 20.4 Scripts

| คำสั่ง | หน้าที่ |
|---|---|
| `npm run dev` | dev server |
| `npm run lint` | ESLint (Next config) |
| `npm run typecheck` | `next typegen && tsc --noEmit` |
| `npm test` | Vitest one-shot |
| `npm run test:e2e` | Playwright |
| `npm run db:migrate` | Prisma migrate dev |
| `npm run db:migrate:deploy` | Prisma migrate deploy (production) |
| `npm run db:seed` | Prisma seed |
| `npm run db:reset` | Drop + migrate + seed |
| `npm run create-admin -- <email> <password> [name]` | สร้าง/update admin user |

### 20.5 Vercel configuration
- `vercel.json` — minimal (ว่างได้); ถ้าจะใช้ Vercel Cron:
  ```json
  {
    "crons": [{"path": "/api/cron/send-emails", "schedule": "* * * * *"}]
  }
  ```
  **แต่** Hobby plan จำกัด 1/day → ต้องใช้ external cron แทน (ดู §12.7)

### 20.6 Database migrations
- Dev: `npm run db:migrate` (`prisma migrate dev`)
- Prod: `npm run db:migrate:deploy` — รันผ่าน CI หรือ manual จาก local
- **ห้าม** `prisma db push` กับ production

---

## 21. Migration Plan (ถ้า rebuild)

ลำดับการ implement ตาม milestone (ประเมิน 6–8 สัปดาห์, 1–2 dev):

### M1 — Foundation (สัปดาห์ 1)
- Next.js 16 setup + Tailwind + Thai font
- Prisma schema + migrations (ดู `prisma/schema.prisma`)
- Auth: register, login, logout, forgot-password, reset-password, session cookie, scrypt
- Admin console shell (`/manage/*`)
- Users CRUD + approve registration
- Departments, sections, pallet-types CRUD
- Audit log + log on every action

### M2 — Stock core (สัปดาห์ 2)
- `moveStock()` + WarehouseStock + StockMovement + DepartmentStock
- Conditional update สำหรับ outflow
- Test: AC-9, AC-14, invariants
- `/manage/adjustments` + ADJUSTMENT op
- Doc counter + `nextDocNo`
- `/app/balance` view page

### M3 — Workflow (สัปดาห์ 3–4)
- Approval route CRUD (`/manage/approval-routes`)
- `createRequest` (ISSUE/RETURN) + step snapshot
- Approve/reject/edit-approve + state machine
- Operating hours + holidays + check at submit
- `/app/requests/*` และ `/app/approvals/*`
- Email outbox + buildRequestEmail + buildUserEmail
- Cron endpoint + external cron setup
- Attachments (Supabase Storage)
- Test: AC-1 ถึง AC-14

### M4 — Warehouse operations (สัปดาห์ 5)
- `/app/warehouse-ops` (REPAIR + WRITE_OFF)
- UI สำหรับ Pallet Manager
- Test: AC-8

### M5 — Dashboard & Export (สัปดาห์ 6)
- Dashboard aggregations (`lib/services/dashboard.ts`)
- Recharts for trend
- Export Excel (`lib/services/export.ts` + exceljs)
- Test: AC-15

### M6 — Hardening & UAT (สัปดาห์ 7–8)
- E2E tests (Playwright) 3 viewports
- Audit log coverage ครบทุก entity/action
- Deploy to Vercel + Supabase
- Pilot ใช้งานกับ 1 แผนก (ผลิต)
- รวบรวม feedback → ลง backlog Phase 2

---

## ภาคผนวก A — ข้อมูลตั้งต้น (Seed)

จาก `prisma/seed.ts`:

**Departments:**
- คลังพาเลท (`isWarehouse = true`)
- พัสดุ
- ผลิต
- จ่ายสินค้า
- ควบคุมคุณภาพ
- เทคโนโลยี

**Users (default password: `Noritake@2026`):**
- `admin@noritake.local` — ADMIN
- `manager@noritake.local` — PALLET_MANAGER (คลังพาเลท)
- `supply1@noritake.local` — REQUESTER (พัสดุ)
- `produce1@noritake.local` — REQUESTER (ผลิต)
- `dispatch1@noritake.local` — REQUESTER (จ่ายสินค้า)

**Pallet types:**
- พาเลทไม้มาตรฐาน 100x120 — sizeSpec `100x120x15`
- พาเลทไม้ EURO 80x120 — `80x120x15`
- พาเลทพลาสติกน้ำเงิน — `110x110x15`
- พาเลทพลาสติกดำ — `100x120x15`
- พาเลทเหล็กแบบกรง — `120x100x100`

**Initial stock** (GOOD condition, in warehouse):
- ไม้มาตรฐาน: 500, EURO: 200, พลาสติกน้ำเงิน: 300, พลาสติกดำ: 150, เหล็กกรง: 30

---

## ภาคผนวก B — ประวัติเวอร์ชัน

| เวอร์ชัน | วันที่ | สรุป |
|---|---|---|
| 0.1 | 2026-09-25 | ร่างแรก |
| 0.2 | 2026-10-02 | Draft — ยังมี locations table |
| 0.3 | 2026-10-10 | ลด location, เปลี่ยนเป็น email+password auth |
| 0.4 | 2026-10-15 | Multi-step approval + email outbox |
| **1.0** | **2026-10-21** | **เอกสารนี้ — สอดคล้อง implementation ปัจจุบัน** |

---

## ภาคผนวก C — ไฟล์ critical ที่ต้องอ่าน

| ไฟล์ | หน้าที่ |
|---|---|
| `prisma/schema.prisma` | Data model — single source of truth |
| `lib/server/stock/index.ts` | `moveStock()` — ทุกการเปลี่ยนยอดคลัง |
| `lib/services/request.ts` | Request lifecycle (create/approve/reject/edit/cancel) |
| `lib/services/approval-route.ts` | Route resolution + snapshot |
| `lib/services/warehouse.ts` | REPAIR, WRITE_OFF |
| `lib/services/operating-hours.ts` | Timezone + check logic |
| `lib/services/email-outbox.ts` | Email templates + queueEmail |
| `lib/services/send-email.ts` | SMTP processor (cron target) |
| `lib/services/docno.ts` | Atomic doc number |
| `lib/services/notification.ts` | Trigger functions |
| `lib/auth/password.ts` | scrypt |
| `lib/auth/session.ts` | HMAC cookie |
| `lib/auth/current-user.ts` | `requireUser`, `requireRole`, `HttpError` |
| `prisma/seed.ts` | ข้อมูลตั้งต้น |
| `CLAUDE.md` | Working rules (ต้องอ่านก่อนแก้) |
