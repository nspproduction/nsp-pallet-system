# Checklist ตรวจสอบระบบ — Pallet System

> อัปเดต: 2026-10-12

---

## 1. Authentication & Session

- [/] สมัครสมาชิกใหม่ → ได้รับอีเมลยืนยันตัวเอง
- [/] สมัครสมาชิกใหม่ → Admin ได้รับอีเมลแจ้งเตือน (ทุก Admin ที่มี email)
- [/] Admin อนุมัติ user → user ได้รับอีเมล "อนุมัติแล้ว" พร้อมปุ่มเข้าสู่ระบบ
- [/] Admin ปฏิเสธ user → user ได้รับอีเมล "ไม่อนุมัติ"
- [/] Login ด้วย email/password ถูกต้อง → redirect ตาม role (ADMIN → `/manage`, อื่น ๆ → `/app`)
- [/] Login ผิด password → แสดง error ภาษาไทย ไม่ crash
- [/] Logout → session หมด → redirect `/auth/login`
- [/] ลืมรหัสผ่าน → ส่ง email reset link
- [/] คลิก reset link → ตั้งรหัสผ่านใหม่ได้ → login ใหม่สำเร็จ
- [/] reset link ที่หมดอายุแล้ว → แสดง error
- [/] `/api/auth/dev-login` และ `/api/auth/dev-users` ปิดในระบบ production (ตรวจ env NODE_ENV)

---

## 2. หน้า Employee Portal (`/app`)

### Dashboard

- [ ] แสดงสถิติ: คำขอรอดำเนินการ, คำขอที่ฉันส่ง, ยอดพาเลทคงเหลือ
- [ ] แสดงได้ถูกต้องเมื่อยังไม่มีคำขอ (empty state)

### สร้างคำขอ (`/app/requests/new`)

- [/] เบิกออก (สีแดง) / คืนเข้า (สีเขียว) สลับ tab ได้ — สีเปลี่ยนทั้งฟอร์ม
- [ ] แสดงแผนก/แผนกย่อยของผู้ใช้ถูกต้อง
- [ ] แสดงยอดพาเลทในคลัง (เบิกได้ / ในคลังตอนนี้) ต่อรายการ
- [ ] กด `+`/`-` → จำนวนเปลี่ยน, ห้ามต่ำกว่า 1
- [ ] ใส่จำนวนเกินยอดคลัง → แสดงคำเตือน + ปุ่ม submit ถูก disable
- [ ] วันที่ต้องการ → เลือกวันย้อนหลังไม่ได้
- [ ] เพิ่มรายการ → การ์ดใหม่ขยายด้านล่าง
- [ ] ลบรายการ → ลบถูกรายการ ไม่กระทบรายการอื่น
- [ ] แนบรูป → ไฟล์ถูกบีบอัด (max 1280px, JPEG 0.82)
- [ ] นอกช่วงเวลาทำรายการ → แสดง banner "คำขอด่วน" + ช่องกรอกเหตุผล
- [ ] ส่งคำขอสำเร็จ → redirect ไปหน้ารายละเอียดคำขอ
- [ ] บัญชีไม่มีแผนก → แสดง error, ปุ่ม submit ถูก disable
- [ ] ประเภทพาเลทที่ `active=false` → ไม่แสดงใน dropdown

### รายการคำขอ (`/app/requests`)

- [ ] แสดงเฉพาะคำขอของตัวเอง
- [ ] กรองตาม status ได้
- [ ] คลิกเข้าดูรายละเอียดได้

### รายละเอียดคำขอ (`/app/requests/[id]`)

- [ ] แสดงสถานะ, รายการพาเลท, ประวัติ timeline
- [ ] แสดงไฟล์แนบ (ถ้ามี)
- [ ] ยกเลิกคำขอ (DRAFT/PENDING) ได้
- [ ] user อื่นเข้าดูคำขอที่ไม่ใช่ของตัวเอง → ถูก block

### การอนุมัติ (`/app/approvals`)

- [ ] แสดงเฉพาะคำขอที่รอการอนุมัติจาก user นี้
- [ ] อนุมัติ/ปฏิเสธ → status เปลี่ยน
- [ ] ผู้สร้างคำขอ **ไม่สามารถ** อนุมัติคำขอของตัวเอง

### ประวัติการอนุมัติ (`/app/approvals/history`)

- [ ] แสดงคำขอที่ตัวเองเคยตัดสินใจไปแล้ว

### ยอดพาเลท (`/app/balance`)

- [ ] แสดงยอดคงเหลือตามแผนก/ประเภทพาเลท/สภาพ

### Warehouse Ops (`/app/warehouse-ops`)

- [ ] (เฉพาะ role WAREHOUSE) รับพาเลทเข้า, บันทึกผลซ่อม, ตัดจำหน่าย ได้

---

## 3. หน้า Admin (`/manage`)

### Dashboard (`/manage`)

- [ ] แสดงสถิติ, กราฟแนวโน้ม, Warehouse Ops panel

### คำขอทั้งหมด (`/manage/requests`)

- [ ] ค้นหา / กรอง status, type, วันที่
- [ ] คลิกเข้าดูและดำเนินการ (approve/reject/complete) ได้
- [ ] export Excel

### แผนก (`/manage/departments`)

- [ ] เพิ่ม / แก้ไข / เปิด-ปิด แผนก
- [ ] กำหนด `isWarehouse = true` ได้

### ประเภทพาเลท (`/manage/pallet-types`)

- [ ] เพิ่ม / แก้ไข ประเภทพาเลท
- [ ] เปิด/ปิดการใช้งาน (`active`) → ประเภทที่ปิดไม่แสดงในฟอร์มสร้างคำขอ

### เส้นทางการอนุมัติ (`/manage/approval-routes`)

- [ ] กำหนด approver ของแต่ละแผนก/section ได้

### ช่วงเวลาทำรายการ (`/manage/operating-hours`)

- [ ] กำหนดวัน/เวลาทำรายการปกติ
- [ ] เพิ่ม / ลบวันหยุด

### ผู้ใช้งาน (`/manage/users`)

- [ ] ดู user ทั้งหมด
- [ ] อนุมัติ / ปฏิเสธ user ใหม่
- [ ] แก้ไข role, แผนก, section

### ปรับยอดพาเลท (`/manage/adjustments`)

- [ ] ปรับยอดขึ้น/ลงพร้อมเหตุผล → StockMovement ถูกสร้าง

### Audit Log (`/manage/audit-logs`)

- [ ] แสดง log การเปลี่ยนแปลงข้อมูล

---

## 4. Role & Access Control

- [ ] User ที่ไม่ได้ login → redirect `/auth/login`
- [ ] User (ไม่ใช่ ADMIN) เข้า `/manage/*` → 403 หรือ redirect
- [ ] User ที่ยังไม่ได้รับการอนุมัติ (`status: PENDING`) → ไม่สามารถใช้งานได้
- [ ] Role `REQUESTER` → สร้างคำขอได้, อนุมัติไม่ได้
- [ ] Role `APPROVER` → อนุมัติได้ เฉพาะสาย approval ที่กำหนด
- [ ] Role `WAREHOUSE` → Warehouse Ops เท่านั้น
- [ ] Role `ADMIN` → เข้าถึงทุกส่วนได้

---

## 5. Email & Notification

- [ ] `GMAIL_USER` และ `GMAIL_APP_PASSWORD` ตั้งค่าใน `.env` / Vercel
- [ ] Cron job `/api/cron/send-emails` ถูกกำหนดใน `vercel.json`
- [ ] ส่ง email ไม่สำเร็จ → บันทึก error, ไม่ล้มเหลวทั้งกระบวนการ (outbox pattern)
- [ ] `emailOutbox` table มี row ที่ `sentAt IS NULL` ลดลงหลัง cron ทำงาน

---

## 6. Environment Variables

| ตัวแปร                 | จำเป็น | ใช้ที่                            |
| ---------------------- | ------ | --------------------------------- |
| `DATABASE_URL`         | ✅     | Prisma runtime (Supavisor pooled) |
| `DIRECT_URL`           | ✅     | Prisma migrate                    |
| `NEXTAUTH_SECRET`      | ✅     | Session signing                   |
| `NEXTAUTH_URL`         | ✅     | Redirect URLs                     |
| `GMAIL_USER`           | ✅     | Nodemailer SMTP                   |
| `GMAIL_APP_PASSWORD`   | ✅     | Nodemailer SMTP                   |
| `NEXT_PUBLIC_BASE_URL` | ⚠️     | Email CTA links                   |
| `NODE_ENV`             | auto   | dev-login guard                   |

- [ ] ทุกตัวแปรใน `.env.example` มีค่าจริงใน Vercel → Settings → Environment Variables
- [ ] `DIRECT_URL` ไม่ได้ใช้ Supavisor (ต้อง connection ตรง)

---

## 7. Data Integrity

- [ ] สร้างคำขอ → StockMovement ยังไม่เกิดจนกว่าจะ COMPLETED
- [ ] COMPLETE request → WarehouseStock เปลี่ยนในเดียวกับที่ StockMovement สร้าง (transaction)
- [ ] ยอดพาเลทในคลัง ≥ 0 เสมอ (ห้ามติดลบ)
- [ ] StockMovement, AuditLog, RequestRevision → ไม่มี endpoint DELETE/UPDATE

---

## 8. API Endpoints

- [ ] `GET /api/health` → `{ ok: true }`
- [ ] `GET /api/auth/me` → คืน user info ถูกต้อง
- [ ] `GET /api/pallet-types` → คืนเฉพาะ `active=true`
- [ ] `POST /api/requests` → validate items ไม่มี `active=false`
- [ ] `POST /api/requests/[id]/approve` → เฉพาะ approver ที่ถูกกำหนด
- [ ] `GET /api/dashboard/export` → เฉพาะ ADMIN

---

## 9. UI/UX

- [ ] ทุกหน้าใช้งานได้ที่ 375px ไม่มี horizontal scroll
- [ ] Loading skeleton แสดงระหว่างโหลดข้อมูล
- [ ] ข้อความ error เป็นภาษาไทย
- [ ] ฟอนต์ Noto Sans Thai โหลดถูกต้อง

---

## 10. Dev-only Routes (ต้องปิดใน Production)

- [ ] `/api/auth/dev-login` — ตรวจว่า guard `NODE_ENV !== "production"` ทำงานจริง
- [ ] `/api/auth/dev-users` — เช่นเดียวกัน
