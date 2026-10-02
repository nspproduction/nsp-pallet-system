# ระบบเบิกจ่ายพาเลท

Web + LINE LIFF สำหรับจัดการการเบิก-รับ-คืน-ซ่อม พาเลทของโรงงาน

**Stack**: Next.js 16 (App Router, TypeScript) · Prisma 6 · Supabase (Postgres + Storage) · LINE LIFF + Messaging API · Tailwind CSS 4 · Noto Sans Thai

**สถานะ**: MVP เสร็จสมบูรณ์ — auth, master data CRUD, request lifecycle (create/approve/reject/fulfill/cancel), stock ledger, adjustments, dashboard, audit log, LINE Flex notifications, attachment upload

**เอกสารประกอบ**
- [Requirement](./docs/REQUIREMENTS.md)
- [ER Diagram](./docs/ER_DIAGRAM.md)

---

## เริ่มต้นใช้งาน

### 1) ติดตั้ง dependencies

```bash
npm install
```

### 2) ตั้งค่า Supabase

1. สร้างโปรเจกต์ใหม่ที่ https://supabase.com
2. คัดลอก `Project URL`, `anon key`, `service_role key` จาก **Settings → API**
3. คัดลอก connection strings จาก **Settings → Database → Connection string**
   - `DATABASE_URL` → ใช้ `Transaction pooler` (port 6543) พร้อม `?pgbouncer=true&connection_limit=1`
   - `DIRECT_URL` → ใช้ `Session pooler` (port 5432) — จำเป็นสำหรับ `prisma migrate`

### 3) ตั้งค่า LINE

1. สร้าง Provider + LINE Login Channel + Messaging API Channel ที่ https://developers.line.biz
2. เพิ่ม **LIFF app** ใน LINE Login Channel
   - **Endpoint URL**: ต้องตรงกับ URL ที่รันจริง — dev ใช้ `http://localhost:3000/liff`, prod ใช้ `https://<your-domain>/liff`
   - **Scope**: เปิด `profile` + `openid`
   - **Size**: Full/Tall/Compact ตามที่ต้องการ
3. คัดลอก `LIFF ID`, `Channel ID` (Login), `Channel Access Token` (Messaging)

### 4) ตั้งค่า env

สร้าง `.env.local` ใน root ของโปรเจกต์ (ไฟล์นี้อยู่ใน `.gitignore` — ห้าม commit) แล้วใส่ตัวแปรตามนี้:

```env
# Database (Supabase Postgres)
DATABASE_URL="postgresql://.../postgres?pgbouncer=true&connection_limit=1"
DIRECT_URL="postgresql://.../postgres"

# Supabase
NEXT_PUBLIC_SUPABASE_URL="https://xxx.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="..."
SUPABASE_SERVICE_ROLE_KEY="..."

# LINE
NEXT_PUBLIC_LIFF_ID="xxxxxxxxxx-xxxxxxxx"
LINE_CHANNEL_ID="xxxxxxxxxx"
LINE_CHANNEL_ACCESS_TOKEN="..."

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"
SESSION_SECRET="<random 32+ chars>"
```

> **สำคัญ**: Prisma CLI อ่านไฟล์ `.env` เท่านั้น ไม่อ่าน `.env.local` โดย default
> โปรเจกต์นี้ตั้ง npm scripts ผ่าน `dotenv-cli` ให้แล้ว — ต้องรัน `npm run db:*` เท่านั้น
> อย่ารัน `npx prisma migrate dev` ตรงๆ (จะเจอ `P1012: Environment variable not found: DIRECT_URL`)

### 5) สร้าง schema + seed data

```bash
npm run db:migrate -- --name init
npm run db:generate
npm run db:seed              # โหลด demo departments/users/pallet types/locations + initial stock
```

Seed สร้างผู้ใช้ตัวอย่าง:

| employeeCode | ชื่อ | role | สถานะ |
|---|---|---|---|
| `EMP-ADMIN`  | Admin Noritake       | ADMIN     | ACTIVE |
| `EMP-APR-01` | หัวหน้าคลัง สมชาย  | APPROVER  | ACTIVE |
| `EMP-STR-01` | พนักงานคลัง สมหญิง | STORE     | ACTIVE |
| `EMP-REQ-01` | หัวหน้าไลน์ อรุณ    | REQUESTER | ACTIVE |
| `EMP-LOG-01` | โลจิสติกส์ วรุณ     | REQUESTER | ACTIVE |

ใน dev สามารถ login ด้วย employeeCode ผ่าน UI (ปุ่ม DEV login ในหน้าแรก) ได้เลย

### 6) สร้าง Supabase Storage bucket

สำหรับไฟล์แนบ (รูปตอน WRITE_OFF, RETURN_CUSTOMER) ต้องมี bucket ชื่อ `attachments`:

1. Supabase dashboard → **Storage** → **New bucket**
2. ชื่อ: `attachments` (private, ไม่ต้อง public)
3. ระบบใช้ service role key สร้าง signed URL ให้ browser upload ตรง

### 7) รัน dev server

```bash
npm run dev
```

- Landing: http://localhost:3000
- LIFF: http://localhost:3000/liff (ทดสอบใน LINE app หรือ browser ที่ตั้ง Endpoint URL ตรงกัน)
- Admin: http://localhost:3000/admin
- Health: http://localhost:3000/api/health

---

## คำสั่งที่ใช้บ่อย (npm scripts)

| คำสั่ง | ทำอะไร |
|---|---|
| `npm run dev` | Dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run start` | รัน production build |
| `npm run lint` | ESLint |
| `npm run db:generate` | Generate Prisma Client |
| `npm run db:migrate` | สร้าง + apply migration (dev) |
| `npm run db:migrate:deploy` | Apply migration ที่มีอยู่ (CI/prod) |
| `npm run db:push` | Push schema โดยไม่สร้าง migration file |
| `npm run db:studio` | เปิด Prisma Studio |
| `npm run db:reset` | รีเซ็ต DB ทั้งก้อน (ระวัง! ลบข้อมูล) |
| `npm run db:seed` | โหลด seed data (departments/users/pallet types/locations + initial stock) |
| `npm run prisma -- <cmd>` | เรียก prisma อะไรก็ได้ผ่าน dotenv-cli |

ตัวอย่าง:

```bash
npm run prisma -- format
npm run prisma -- migrate status
npm run db:migrate -- --name add_notification_table
```

> **ทำไมต้องมี `--` คั่น?** — npm ใช้เพื่อบอกว่า flag ที่ตามมาส่งให้ script ไม่ใช่ให้ npm

---

## Deploy บน Vercel

1. Push repo ไป GitHub
2. Import project ใน Vercel
3. ตั้ง **Environment Variables** (คัดค่าจาก `.env.local`) — Vercel inject เข้า `process.env` โดยตรง ไม่ต้องพึ่ง dotenv-cli
4. **Build Command**: `prisma generate && next build` (หรือใส่ใน `postinstall`)
5. Deploy — Vercel จะสร้าง URL ให้ นำไปตั้งเป็น **Endpoint URL** ของ LIFF app
6. รัน migration บน prod (ถ้าใช้ Vercel Deploy Hooks หรือรันจาก local):
   ```bash
   # ตั้ง DATABASE_URL/DIRECT_URL ชี้ prod ก่อน
   npm run db:migrate:deploy
   ```

---

## โครงสร้างโฟลเดอร์

```
app/
  page.tsx                  landing + AuthPanel (dev-login + status)
  layout.tsx                root layout + Noto Sans Thai
  globals.css               tailwind v4 tokens (brand, surface, border, danger, ...)
  _components/              PageHeader, Card, Table, StatusBadge, EmptyState, AuthPanel
  liff/                     LIFF UI (max-w-md mobile-first)
    page.tsx                home + LINE login
    requests/               list, new (dynamic items), [id] detail + upload
    approvals/              list + inline approve/reject
    balance/                stock view filter by location type
  admin/                    Web admin (sidebar + top bar + active state)
    page.tsx                Dashboard with real KPI
    requests/               list + [id] detail + inline actions
    outstanding/            by location type (INTERNAL/CUSTOMER/REPAIR_SHOP)
    pallet-types/           CRUD
    locations/              CRUD
    departments/            CRUD
    users/                  list + activate/edit
    adjustments/            list + create
    audit-logs/             list
  api/
    auth/
      line/route.ts           verify LIFF id_token + set session
      dev-login/route.ts      DEV-only impersonate by employeeCode
      me/route.ts             session check
      logout/route.ts
    requests/                CRUD + approve/reject/fulfill
    pallet-types, locations, departments, users
    adjustments, audit-logs, dashboard, outstanding, balances
    attachments/             upload-url + create + view-url + delete
    health/
middleware.ts               cookie-based gate for /admin
lib/
  auth/
    session.ts               HMAC-signed cookie
    current-user.ts          requireUser/requireRole
  http/respond.ts            ok/fail/readJson + zod handling
  services/
    request.ts               create/cancel/approve/reject/fulfill + soft-reserve + stock gen
    docno.ts                 raw-SQL doc_counters upsert (PL-<TYPE>-<YYMM>-<seq>)
    dashboard.ts             KPI + outstanding by location
    notification.ts          LINE Messaging push + Flex builder
    attachment.ts            Supabase Storage signed URL flow
    audit.ts                 writeAudit + listAuditLogs
  liff/                       client + id_token verify
  supabase/                   server + browser clients
  prisma.ts                   Prisma singleton
  stock.ts                    balance query helpers
prisma/
  schema.prisma
  seed.ts                     demo data
  migrations/
docs/
  REQUIREMENTS.md
  ER_DIAGRAM.md
```

---

## Request Lifecycle

```
DRAFT ─┐
       │  requester submit
       ▼
    PENDING ── approver approve ─▶ APPROVED ── store fulfill ─▶ FULFILLED (stock เปลี่ยน)
       │            │                                                ▲
       │            └─▶ REJECTED (comment required)                  │
       │                                                             │
       └─▶ CANCELLED (requester ก่อน approve)               stock_movements
```

**กฎที่ระบบบังคับ**
- ผู้ร้องขอ ≠ ผู้อนุมัติ (บังคับที่ service layer + audit)
- Store ต้องกรอก `actualQuantity` ตอน fulfill; ระบบเทียบกับ `quantity` ที่ขอ
- คำขอที่ PENDING/APPROVED สำหรับประเภทที่ **หัก** สต็อก (`ISSUE_INTERNAL`, `SHIP_CUSTOMER`, `SEND_REPAIR`, ...) จะ **soft-reserve** ยอดที่คลังต้นทาง — ห้าม create เกินยอด available
- `stock_movements` เกิดขึ้น **ตอน FULFILL เท่านั้น** (ไม่ใช่ตอน approve)
- `Adjustment` ผ่าน `/admin/adjustments` สร้าง movement ตรงๆ (ADMIN only, มี audit)

## Notifications (LINE Messaging API)

ระบบยิง **Flex message** ผ่าน LINE Messaging API เมื่อ:

| เหตุการณ์ | ผู้รับ |
|---|---|
| คำขอใหม่ถูกสร้าง (PENDING) | ทุก APPROVER + ADMIN ที่ active & มี LINE ID |
| คำขอถูก APPROVED / REJECTED | ผู้ร้องขอ |
| คำขอถูก FULFILLED | ผู้ร้องขอ |
| Stock ต่ำกว่า `minStock` | ทุก ADMIN (เรียก `notifyLowStock()` เอง; ยังไม่ hook auto ใน MVP) |

**เงื่อนไข**: ผู้รับต้องเป็นเพื่อนกับ LINE Official Account (Messaging API channel) มิฉะนั้น push จะ fail (บันทึกใน `notifications.error`)

## Design system (สรุปย่อ)

- **Font**: `Noto Sans Thai` (weight 300–800) โหลดผ่าน `next/font/google`; mono: `JetBrains Mono`
- **Palette**: brand = indigo (`--color-brand-*`), surface, border, success/warning/danger tokens ประกาศใน `app/globals.css` ผ่าน `@theme inline` ของ Tailwind v4 — ใช้เป็น utility เช่น `bg-brand-600`, `text-brand-700` ได้เลย
- **Layout**:
  - Landing มี hero + portal cards (LIFF/Admin) + feature strip
  - Admin ใช้ sidebar แบ่งกลุ่ม (หลัก / ข้อมูลหลัก / ระบบ) + top bar breadcrumb + drawer สำหรับมือถือ
  - LIFF ใช้ gradient header + quick action + menu cards (แบบ mobile-first max-w-md)

---

## แก้ปัญหาที่พบบ่อย

### 1) `P1012: Environment variable not found: DIRECT_URL`

Prisma อ่าน `.env` ไม่ใช่ `.env.local` — ใช้ npm scripts ที่ prefix ด้วย `dotenv-cli` แทน:

```bash
npm run db:migrate           # ✅ ถูกต้อง
npx prisma migrate dev       # ❌ จะเจอ P1012
```

### 2) LIFF ขึ้น "400 Bad Request" หลังกด login LINE

`redirect_uri` ที่ส่งไปไม่ตรงกับ **Endpoint URL** ที่ลงทะเบียนใน LIFF console

- Dev: ตั้ง Endpoint URL เป็น `http://localhost:3000/liff` ให้ตรง
- โค้ดปัจจุบันเรียก `liff.login()` โดยไม่ส่ง `redirectUri` — SDK จะใช้ Endpoint URL ที่ลงทะเบียนไว้อัตโนมัติ

### 3) เปลี่ยน `NEXT_PUBLIC_LIFF_ID` แล้วยังใช้ค่าเดิม

Next.js embed ค่า `NEXT_PUBLIC_*` ที่ dev server start — ต้อง **restart dev server** หลังแก้ `.env.local`

### 4) `[Violation] Permissions policy violation: unload is not allowed`

Warning จาก LIFF SDK ที่ใช้ deprecated `unload` event — **ไม่ block การทำงาน** ปล่อยไว้ได้

### 5) ต้องการเปิด LIFF จาก LINE app จริง

ใช้ URL `https://liff.line.me/<LIFF_ID>` — LINE จะ redirect ไปยัง Endpoint URL ที่ลงทะเบียนให้เอง

---

## หมายเหตุด้านความปลอดภัย

- ห้ามเชื่อ `lineUserId` ที่ browser ส่งมาตรงๆ — ตรวจ `id_token` ที่ server เสมอ (`lib/liff/verify.ts`)
- ผู้ใช้ใหม่ต้องรอ Admin อนุมัติสถานะเป็น `ACTIVE` ก่อนใช้งานได้
- ผู้ร้องขอกับผู้อนุมัติต้องไม่ใช่คนเดียวกัน — บังคับที่ service layer
- `stock_movements` เขียนได้จาก service layer เท่านั้น ห้ามให้ client เขียนตรง
- ห้าม commit `.env.local` (มีอยู่ใน `.gitignore` ของ Next.js อยู่แล้ว)
