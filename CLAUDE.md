# CLAUDE.md

ระบบเบิก/คืนพาเลทหมุนเวียนในโรงงาน — requirement ทั้งหมดอยู่ใน `SPEC.md` **อ่านก่อนเริ่มงานทุกครั้ง**

## วิธีทำงาน

- ก่อนเขียนโค้ด: สรุปสิ่งที่จะทำ, อ้างอิงข้อใน SPEC (เช่น BR-3, AC-6), และเสนอแผน รอการอนุมัติก่อนลงมือ
- ถ้าเจอจุดที่ SPEC ไม่ได้ระบุ หรือติด 🟡 Open Question → **ถาม อย่าเดา**
- ทำทีละ milestone ตาม SPEC ข้อ 17 ห้ามทำเกินขอบเขต (ดู Out of scope — โดยเฉพาะ **ห้ามสร้างการติดตามยอดนอกคลัง**)
- เขียน test จาก Acceptance Criteria ก่อน แล้วค่อย implement ห้ามแก้ test เพื่อให้ผ่าน เว้นแต่ได้รับอนุญาต
- งานเสร็จ = `npm run lint && npm run typecheck && npm test` ผ่านทั้งหมด

## Tech stack

- Next.js (App Router) + TypeScript (strict)
- Prisma ORM + PostgreSQL บน Supabase
- Deploy บน Vercel
- UI: Tailwind CSS + shadcn/ui, responsive แบบ mobile-first
- ฟอนต์: Noto Sans Thai ผ่าน `next/font/google` ตั้งเป็นฟอนต์หลักของทั้งแอป
- Validation: Zod (ใช้ schema เดียวกันทั้ง form และ server)
- Email: ผ่าน outbox table + provider ตาม SPEC Q14
- Excel export: exceljs (สร้างไฟล์ฝั่ง server)
- Test: Vitest (unit/integration), Playwright (E2E + ทดสอบ viewport 375 / 768 / 1280)
- Package manager: **npm** (ห้ามใช้ pnpm/yarn, commit `package-lock.json`)

## คำสั่ง

```
npm run dev                 # รัน dev server
npm run lint
npm run typecheck
npm test                    # Vitest
npm run test:e2e            # Playwright
npx prisma migrate dev      # สร้าง migration (ห้ามใช้ db push กับ production)
npx prisma db seed          # ข้อมูลตัวอย่าง: แผนก, section, ประเภทพาเลท, user ทุก role, ช่วงเวลาทำรายการ
```

## โครงสร้างโฟลเดอร์

```
src/app/            # routes: (auth), (app)/requests, (app)/approvals, (app)/warehouse, (app)/dashboard, admin/
src/server/         # business logic ทั้งหมด (services) — UI ห้ามเรียก Prisma ตรง
  stock/            # service เปลี่ยนยอดคลัง (จุดเดียวที่แก้ WarehouseStock/StockMovement)
  requests/         # สร้างคำขอ, state machine, ตรวจช่วงเวลาทำรายการ
  approvals/        # route, snapshot, การอนุมัติ, revision
  warehouse/        # รับใหม่, ผลซ่อม, ตัดจำหน่าย, ปรับยอด
  notifications/    # in-app + email outbox
  reports/          # query ของ Dashboard + export Excel
  auth/             # session, การตรวจสิทธิ์
src/lib/            # utilities, zod schemas, เวลา (Asia/Bangkok)
prisma/             # schema.prisma, migrations, seed.ts
tests/              # unit, integration, e2e
```

## กฎสำคัญ (ห้ามละเมิด)

1. **การเปลี่ยนยอดคลังทุกครั้งผ่าน `src/server/stock` เท่านั้น** และทำใน `prisma.$transaction` ที่เขียน StockMovement + อัปเดต WarehouseStock พร้อมกัน
2. StockMovement, RequestRevision, AuditLog เป็น **append-only** — ห้ามเขียนโค้ด update/delete ตารางเหล่านี้
3. ป้องกันยอดติดลบด้วย conditional update ใน DB (เช่น `WHERE quantity >= :qty`) หรือ row lock ห้ามเช็กยอดใน JS แล้วค่อยเขียน (race condition)
4. คืนเกินยอดเบิกสะสมของแผนก **ห้ามบล็อก** ให้แสดงคำเตือนเท่านั้น (BR-3)
5. ตรวจสิทธิ์ที่ server ทุก Server Action / Route Handler ด้วย helper กลาง (`requireRole`, `requireApproverOf`)
6. ห้ามให้ผู้สร้างคำขออนุมัติคำขอของตัวเอง
7. ตรวจช่วงเวลาทำรายการด้วยเวลา server ในโซน Asia/Bangkok เท่านั้น
8. การส่ง email ห้ามอยู่ใน transaction ของการอนุมัติ — เขียนลง outbox ใน transaction แล้วค่อยส่งแยก ส่งไม่สำเร็จต้องไม่ทำให้การอนุมัติล้มเหลว
9. ยอดพาเลทเป็นจำนวนเต็มบวกเสมอ; เวลาเก็บเป็น UTC แสดงผล Asia/Bangkok
10. ห้าม commit secret; ค่าทั้งหมดอยู่ใน `.env` (มี `.env.example` ไว้ให้)

## Database / Supabase

- `DATABASE_URL` = connection แบบ pooled (Supavisor, transaction mode) สำหรับ runtime บน Vercel
- `DIRECT_URL` = connection ตรง สำหรับ `prisma migrate`
- ใช้ Prisma เป็นช่องทางหลัก ไม่พึ่ง Supabase RLS สำหรับ business rule (แต่ต้องเปิด RLS ปิดการเข้าถึงตารางผ่าน anon key)

## Conventions

- ข้อความบน UI และ email เป็นภาษาไทย; ชื่อตัวแปร/ฟังก์ชัน/commit เป็นภาษาอังกฤษ
- Server Actions สำหรับ mutation, Server Components สำหรับอ่านข้อมูล
- Enum ของสถานะ/ประเภทคำขอ/สภาพพาเลท ใช้ชื่อตาม SPEC ข้อ 6–7
- ทุกหน้าต้องใช้งานได้ที่ความกว้าง 375px โดยไม่มี horizontal scroll (ตารางยาวให้เปลี่ยนเป็น card บนมือถือ)
- Commit แบบ Conventional Commits (`feat:`, `fix:`, `test:` …)
