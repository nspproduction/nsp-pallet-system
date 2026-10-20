# ระบบเบิกจ่ายพาเลท — Pallet Management System

ระบบจัดการการเบิก-คืน-ซ่อม-ตัดจำหน่ายพาเลทหมุนเวียนในโรงงาน

**Stack**: Next.js 16 (App Router, TypeScript) · Prisma 6 · Supabase (Postgres) · Tailwind CSS 4 · Resend (Email) · Noto Sans Thai

---

## โครงสร้าง URL

| URL | ผู้ใช้ |
|---|---|
| `/` | หน้าแรก (เลือกพอร์ทัล) |
| `/app` | พนักงาน — สร้างคำขอ, ดูสถานะ, อนุมัติ |
| `/manage` | Admin / Pallet Manager — Dashboard, จัดการข้อมูล, รายงาน |
| `/auth/login` | เข้าสู่ระบบ (ใช้ได้ทั้ง 2 ฝั่ง) |
| `/auth/register` | สมัครใช้งาน (public) |
| `/auth/forgot-password` | ลืมรหัสผ่าน |
| `/auth/reset-password` | รีเซ็ตรหัสผ่าน |

---

## รันบนเครื่อง (Local)

### 1) สร้าง Supabase project

1. ไปที่ [supabase.com](https://supabase.com) → New project
2. เลือก Region: **Southeast Asia (Singapore)**
3. หลัง project สร้างเสร็จ ไปที่ **Settings → Database** และ **Settings → API** เก็บค่าไว้

### 2) ติดตั้ง dependencies

```bash
npm install
```

### 3) สร้างไฟล์ `.env.local`

```bash
cp .env.example .env.local
```

เปิด `.env.local` แล้วกรอกค่าจริง:

```env
# Supabase → Settings → Database → Connection string
# ใช้ Transaction pooler (port 6543) สำหรับ runtime
DATABASE_URL=postgresql://postgres.<ref>:<pass>@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
# ใช้ Direct connection (port 5432) สำหรับ prisma migrate เท่านั้น
DIRECT_URL=postgresql://postgres.<ref>:<pass>@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres

# Supabase → Settings → API
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# สร้าง SESSION_SECRET ด้วย PowerShell:
# [Convert]::ToBase64String((1..32 | % { Get-Random -Max 256 }))
SESSION_SECRET=<random-32-char-secret>

# Email — ถ้ายังไม่พร้อมใส่ dummy ไปก่อน ระบบยังทำงานได้
RESEND_API_KEY=re_dummy
RESEND_FROM=noreply@example.com

# Cron — ใช้ random string ใดก็ได้ (ใน local ไม่ถูกเรียก)
CRON_SECRET=any-local-secret
```

> **หมายเหตุ**: Prisma CLI อ่าน `.env` ไม่ใช่ `.env.local` — ต้องรันผ่าน `npm run db:*` เสมอ อย่ารัน `npx prisma` ตรงๆ

### 4) สร้างตาราง + ข้อมูลตัวอย่าง

```bash
# สร้าง Prisma Client
npm run db:generate

# Apply migration สร้างตาราง
npm run db:migrate:deploy

# ใส่ข้อมูลตัวอย่าง (แผนก, ประเภทพาเลท, user ทดสอบ, ยอดสต็อกเริ่มต้น)
npm run db:seed
```

ข้อมูล seed ที่ได้:

| email | ชื่อ | Role | สถานะ |
|---|---|---|---|
| `admin@noritake.local` | Admin | ADMIN | ACTIVE |
| `manager@noritake.local` | หัวหน้าคลังพาเลท ทดสอบ | PALLET_MANAGER | ACTIVE |
| `supply1@noritake.local` | พนักงานพัสดุ ทดสอบ | REQUESTER | ACTIVE |
| `produce1@noritake.local` | พนักงานผลิต ทดสอบ | REQUESTER | ACTIVE |
| `dispatch1@noritake.local` | พนักงานจ่ายสินค้า ทดสอบ | REQUESTER | ACTIVE |

> Seed users ยังไม่มีรหัสผ่าน ใช้ **dev-login** (dev เท่านั้น) หรือรันคำสั่งด้านล่างเพื่อตั้งรหัสผ่าน

### 5) สร้าง Admin user สำหรับ Login

```bash
# รูปแบบ: npm run create-admin -- <email> <password> [ชื่อเต็ม]
npm run create-admin -- admin@noritake.local MyPassword123 "ผู้ดูแลระบบ"
```

### 6) รัน dev server

```bash
npm run dev
```

เปิด browser:
- `http://localhost:3000` — หน้าแรก
- `http://localhost:3000/auth/login` → เข้าสู่ระบบด้วย `admin` / `MyPassword123`
- `http://localhost:3000/auth/register` → สมัครใช้งาน (public)
- `http://localhost:3000/app` → พอร์ทัลพนักงาน

---

## Deploy บน Vercel

### 1) Push code ขึ้น GitHub

```bash
git init
git add .
git commit -m "feat: initial pallet system"
git remote add origin https://github.com/<username>/<repo>.git
git push -u origin main
```

> ตรวจสอบว่า `.gitignore` มี `.env.local` (มีอยู่แล้วใน default Next.js gitignore)

### 2) Import project ใน Vercel

1. ไปที่ [vercel.com](https://vercel.com) → **Add New Project** → Import GitHub repo
2. Framework: **Next.js** (detect อัตโนมัติ)
3. Root Directory: `pallet-system` (ถ้า repo มี folder นี้)
4. Build Command: ปล่อย default (`prisma generate && next build`)

### 3) ตั้ง Environment Variables ใน Vercel

**Settings → Environment Variables** → ใส่ค่าทั้งหมด (เปลี่ยนจาก local เฉพาะที่ระบุ):

| Key | ค่าสำหรับ Production |
|---|---|
| `DATABASE_URL` | pooled connection (port 6543) ของ Supabase project |
| `DIRECT_URL` | direct connection (port 5432) |
| `NEXT_PUBLIC_SUPABASE_URL` | เหมือน local |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | เหมือน local |
| `SUPABASE_SERVICE_ROLE_KEY` | เหมือน local |
| `NEXT_PUBLIC_APP_URL` | `https://your-app.vercel.app` |
| `SESSION_SECRET` | **random ใหม่** (ไม่ซ้ำกับ local) |
| `RESEND_API_KEY` | API key จาก [resend.com](https://resend.com) |
| `RESEND_FROM` | อีเมลที่ verify domain แล้ว เช่น `noreply@yourdomain.com` |
| `CRON_SECRET` | **random ใหม่** สำหรับ cron job |

### 4) Deploy

กด **Deploy** รอ build เสร็จ (~3 นาที)

### 5) Apply migration + Seed บน Production DB

รันจากเครื่อง local โดยชี้ไปที่ Production DB:

```bash
# Windows PowerShell
$env:DATABASE_URL = "postgresql://postgres.<ref>:<pass>@...supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
$env:DIRECT_URL   = "postgresql://postgres.<ref>:<pass>@...supabase.com:5432/postgres"

npx dotenv-cli -e .env.local -- prisma migrate deploy
npx dotenv-cli -e .env.local -- tsx prisma/seed.ts
npx dotenv-cli -e .env.local -- tsx scripts/create-admin.ts ADMIN-001 StrongPassword123 "ผู้ดูแลระบบ"
```

> หรือตั้ง `DIRECT_URL` ชั่วคราวใน `.env.local` ให้ชี้ production แล้วรัน `npm run db:migrate:deploy` ก็ได้

### 6) ตรวจสอบ Cron Job

`vercel.json` ตั้ง cron ส่ง email จาก outbox ทุก 1 นาทีไว้แล้ว:

```json
{ "path": "/api/cron/send-emails", "schedule": "* * * * *" }
```

Cron จะทำงานอัตโนมัติหลัง deploy — ตรวจสอบได้ที่ **Vercel Dashboard → Functions → Cron Jobs**

---

## คำสั่งที่ใช้บ่อย

| คำสั่ง | ทำอะไร |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check |
| `npm test` | Vitest unit tests |
| `npm run test:e2e` | Playwright E2E tests (ต้อง server รันอยู่) |
| `npm run db:generate` | Generate Prisma Client |
| `npm run db:migrate` | สร้าง + apply migration (dev) |
| `npm run db:migrate:deploy` | Apply migration ที่มีอยู่ (prod/CI) |
| `npm run db:seed` | โหลด seed data |
| `npm run db:studio` | เปิด Prisma Studio |
| `npm run db:reset` | รีเซ็ต DB ทั้งหมด (**ระวัง**: ลบข้อมูล) |
| `npm run create-admin -- <code> <pass> [name]` | สร้าง/อัปเดต admin user |

### รัน Playwright E2E

```bash
# ติดตั้ง browser (ครั้งแรกเท่านั้น)
npx playwright install chromium

# รัน (ต้องมี dev server รันอยู่ หรือตั้ง PLAYWRIGHT_BASE_URL)
npm run test:e2e

# รัน authenticated tests (ต้องมี user ใน DB)
E2E_ADMIN_USER=ADMIN-001 E2E_ADMIN_PASS=MyPassword123 npm run test:e2e
```

---

## โครงสร้างโฟลเดอร์

```
app/
  page.tsx              หน้าแรก (เลือกพอร์ทัล)
  layout.tsx            root layout + Noto Sans Thai
  globals.css           Tailwind v4 tokens
  _components/          UI components ร่วม
  portal/               พอร์ทัลพนักงาน (mobile-first, max-w-md)
    page.tsx            หน้าแรก (session auth → เมนู)
    requests/           รายการคำขอ + สร้างใหม่ + รายละเอียด
    approvals/          คิวรออนุมัติ + ประวัติ
    balance/            ยอดสต็อกในคลัง
    warehouse-ops/      จัดการคลัง (ซ่อม, ตัดจำหน่าย)
  admin/                Admin console
    page.tsx            Dashboard (KPI, รายงาน, filter, trend chart)
    requests/           จัดการคำขอ
    users/              จัดการผู้ใช้
    departments/        จัดการแผนก
    pallet-types/       จัดการประเภทพาเลท
    approval-routes/    ตั้ง approval route
    adjustments/        ปรับยอดสต็อก
    audit-logs/         Audit log
    operating-hours/    ช่วงเวลาทำรายการ
  auth/                 หน้า login, register, forgot/reset-password
  api/                  Route Handlers
    auth/               me, admin-login, logout
    requests/           CRUD + approve/reject/editAndApprove
    warehouse-ops/      summary, repair, write-off
    dashboard/          summary, export (.xlsx)
    cron/               send-emails (cron job)
lib/
  auth/                 session, current-user, password
  services/             business logic (request, warehouse, dashboard, export, email)
  prisma.ts             Prisma singleton
  http/respond.ts       ok/fail helpers
prisma/
  schema.prisma
  seed.ts
  migrations/
tests/
  setup.ts              Vitest global mock
  *.test.ts             Unit tests (56 tests)
  e2e/                  Playwright E2E tests
scripts/
  create-admin.ts       สร้าง admin user
```

---

## แก้ปัญหาที่พบบ่อย

### `P1012: Environment variable not found: DIRECT_URL`

Prisma อ่าน `.env` ไม่ใช่ `.env.local` — ใช้ npm scripts เสมอ:

```bash
npm run db:migrate       # ✅
npx prisma migrate dev   # ❌ จะเจอ P1012
```

### Build ล้มเหลวบน Vercel: `Can't reach database server`

`DIRECT_URL` ใน Vercel ต้องชี้ port 5432 (direct) ไม่ใช่ 6543 (pooled) — Prisma ใช้ `DIRECT_URL` ตอน build เพื่อ introspect schema

### `SESSION_SECRET` ต่างกัน = ผู้ใช้ถูก logout

ถ้าเปลี่ยน `SESSION_SECRET` ใน Vercel → session เดิมทั้งหมดจะ invalid — ผู้ใช้ต้อง login ใหม่

### Email ไม่ถูกส่ง

1. ตรวจสอบ `RESEND_API_KEY` และ `RESEND_FROM` ใน Vercel Environment Variables
2. Domain ใน `RESEND_FROM` ต้องผ่านการ verify ใน Resend dashboard
3. ดู outbox ที่ค้างอยู่ได้ผ่าน Prisma Studio: `npm run db:studio`

### ต้องการ reset DB และเริ่มใหม่ (dev เท่านั้น)

```bash
npm run db:reset    # ลบทุกตาราง + re-migrate + seed อัตโนมัติ
```

---

## การ Update ไฟล์นี้

README.md ต้องอัปเดตทุกครั้งที่มีการเปลี่ยนแปลงที่กระทบขั้นตอน run/deploy:

- เพิ่ม/ลบ environment variable → อัปเดตตาราง env ในหัวข้อ "3) ตั้ง Environment Variables"
- เพิ่ม npm script ใหม่ → อัปเดตตาราง "คำสั่งที่ใช้บ่อย"
- เปลี่ยน port/URL/routing สำคัญ → อัปเดต "โครงสร้าง URL"
- เพิ่ม service ภายนอก (เช่น storage, OAuth) → เพิ่มหัวข้อ setup ใหม่
