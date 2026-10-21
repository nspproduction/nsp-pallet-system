# ระบบเบิกจ่ายพาเลท — Requirements

> **เวอร์ชัน:** 1.0 (สอดคล้องกับ implementation ปัจจุบัน — 2026-10-21)
> **ผู้จัดทำ:** Noritake Thailand — ฝ่ายวางแผนการผลิต
> **เอกสารที่เกี่ยวข้อง:** [`SPEC.md`](./SPEC.md) (รายละเอียดเชิงเทคนิค), [`ER_DIAGRAM.md`](./ER_DIAGRAM.md) (โครงสร้างข้อมูล)

เอกสารนี้บรรยาย **สิ่งที่ระบบต้องทำได้** (functional + non-functional requirements) ในมุมมองธุรกิจและผู้ใช้ สำหรับรายละเอียดเทคนิค (API, data model, state machine, business logic) ให้ดู `SPEC.md`

---

## 1. บริบท (Context)

โรงงาน Noritake ใช้พาเลทไม้/พลาสติก/เหล็ก หมุนเวียนระหว่าง "คลังพาเลท" กับแผนกผลิต/พัสดุ/จ่ายสินค้า/QA/RD ปัจจุบันบันทึกการเบิก-คืนด้วยกระดาษ ทำให้:

- ยอดคงเหลือในคลังไม่ตรง (หาพาเลทไม่เจอ)
- ตามคืนไม่ทัน พาเลทค้างที่แผนกนาน
- ไม่รู้สัดส่วนพาเลทเสีย/รอซ่อม
- การอนุมัติล่าช้า (กระดาษไหลระหว่างแผนก)

**วัตถุประสงค์หลัก**

1. รู้ยอดพาเลทในคลัง (ตามประเภท × สภาพ) ได้ตลอดเวลา
2. ให้พนักงานเบิก-คืนผ่านมือถือ/คอมพิวเตอร์ และผ่าน approval workflow
3. บันทึกการเคลื่อนไหวทุกครั้งแบบตรวจย้อนได้
4. มี dashboard สำหรับผู้บริหารและหัวหน้าคลัง

---

## 2. ขอบเขต (Scope)

### 2.1 In Scope (v1.0)

- Web application แบบ responsive (รองรับมือถือ 375px ขึ้นไป)
- ระบบสมาชิก email + password พร้อม admin approval
- การเบิก (ISSUE) และคืน (RETURN) พาเลทผ่าน approval workflow หลายขั้น
- ผลซ่อม (REPAIR_RESULT) และตัดจำหน่าย (WRITE_OFF) โดย Pallet Manager
- ปรับยอด (ADJUSTMENT) โดย Admin — ใช้สำหรับทั้ง "รับพาเลทใหม่เข้าคลัง" และ "แก้ยอดจากการตรวจนับ"
- Admin console: จัดการ user, แผนก, section, ประเภทพาเลท, approval route, ช่วงเวลาทำรายการ, วันหยุด
- การแจ้งเตือน in-app + email (Gmail SMTP)
- Dashboard แสดงยอดคลัง + รายการคำขอ + export Excel
- Audit log ครบทุก entity
- แนบรูปในคำขอ (เก็บใน Supabase Storage)

### 2.2 Out of Scope (v1.0)

- **การติดตามยอดนอกคลัง** — ระบบรู้แค่ "เบิกไปเท่าไร คืนมาเท่าไร" ไม่ได้เก็บว่าแต่ละแผนกถือพาเลทอยู่กี่ใบ
  - แต่ schema เก็บ `fromDepartment / toDepartment` ของทุก movement ไว้ครบ → เฟสถัดไปเปิด report ได้
- **การย้ายพาเลทระหว่างแผนกโดยไม่ผ่านคลัง** (ไม่มี transaction type สำหรับ transfer)
- **การ track supplier / customer / repair shop** — พาเลทที่ลูกค้าส่งกลับ ให้แผนกจ่ายสินค้าทำคำขอ "คืน" ตามปกติ
- **การติดตามพาเลทรายตัว** (serial, barcode, RFID) — ระบบนับเป็น bulk ตามประเภท
- **คำขอด่วนนอกเวลาทำการ** — ปัจจุบันระบบ **บล็อก** การส่งคำขอนอกช่วงเวลาทำรายการ (ยังไม่มีฟีเจอร์ urgent request)
- **แจ้งเตือนผ่าน LINE / SMS**
- **เชื่อม ERP** / API ให้ระบบอื่น
- **Mobile native app** — ใช้ web responsive แทน

### 2.3 Phase 2 (ยังไม่ทำ แต่เตรียม schema ไว้แล้ว)

- Per-department balance report (ยอดคงเหลือรายแผนก)
- Aging report + alert พาเลทค้างเกิน SLA
- Reorder point / แจ้งเตือนยอดต่ำ (schema `PalletType.sizeSpec` มีช่องเก็บ)
- Urgent request (คำขอด่วนนอกเวลา พร้อมเหตุผล)
- SUPER_ADMIN role
- หน้า "รับพาเลทใหม่เข้าคลัง" แยกจาก ADJUSTMENT

### 2.4 Phase 3

- Per-unit tracking (QR/RFID)
- ERP integration
- Mobile app

---

## 3. ผู้ใช้ (Users / Personas)

### 3.1 Roles

| Role | คำอธิบาย | ตัวอย่างผู้ใช้ |
|---|---|---|
| **REQUESTER** | พนักงานที่สร้างคำขอเบิก/คืนในนามแผนกตัวเอง | พนักงานผลิต, พัสดุ, QA |
| **DEPT_APPROVER** | หัวหน้างานที่อนุมัติคำขอของแผนกตัวเอง (step 1..n) | หัวหน้าแผนกผลิต, หัวหน้ากะ |
| **PALLET_MANAGER** | หัวหน้าคลังพาเลท — อนุมัติขั้นสุดท้าย + ทำงานคลัง | หัวหน้าคลังพาเลท |
| **VIEWER** | ดู dashboard อย่างเดียว | ผู้บริหาร, ผู้จัดการโรงงาน |
| **ADMIN** | จัดการข้อมูลหลักและ configuration ทั้งระบบ | admin IT, super user |

**กฎ:**
- User 1 คนมีได้หลาย role (เช่น พนักงานผลิตที่เป็นหัวหน้าด้วย = REQUESTER + DEPT_APPROVER)
- ไม่มี `SUPER_ADMIN` ในเวอร์ชันนี้ (Admin เป็น top-level)

### 3.2 User Status

| Status | ความหมาย | เข้าใช้งานได้ไหม |
|---|---|---|
| `PENDING` | เพิ่งสมัคร รอ admin อนุมัติ | ❌ เห็นแค่หน้า "รอการอนุมัติ" |
| `ACTIVE` | ใช้งานได้ปกติ | ✅ |
| `DISABLED` | ถูกระงับโดย admin | ❌ เห็นข้อความ "บัญชีถูกระงับ" |

### 3.3 Access Control

| Role | /app (portal) | /manage (admin console) |
|---|---|---|
| REQUESTER | ✅ สร้างคำขอ, ดูของตัวเอง | ❌ |
| DEPT_APPROVER | ✅ + หน้าอนุมัติ | ❌ |
| PALLET_MANAGER | ✅ + warehouse ops | ❌ |
| VIEWER | ✅ ดู dashboard + balance | ❌ |
| ADMIN | ✅ ทุกอย่าง | ✅ ทุกอย่าง |

---

## 4. การลงทะเบียน & Authentication

### 4.1 สมัครสมาชิกใหม่

**ข้อมูลที่กรอก:**
- Email (unique — ใช้ login)
- Password (ขั้นต่ำ 8 ตัวอักษร)
- ชื่อ-นามสกุล (ภาษาไทย)
- เบอร์โทร (optional)
- แผนก (จาก dropdown)
- Section (optional, dropdown ของแผนกที่เลือก)

**ขั้นตอน:**
1. User กรอกฟอร์ม `/auth/register`
2. ระบบสร้าง user สถานะ `PENDING`, roles = `[REQUESTER]` (default)
3. ส่ง email แจ้ง **admin ทุกคน** ว่ามีสมาชิกใหม่
4. ส่ง email confirm ให้ **ผู้สมัคร** ว่าได้รับใบสมัครแล้ว
5. User login ได้ แต่เห็นแค่หน้า "กำลังรอการอนุมัติจากผู้ดูแลระบบ"
6. Admin ไปที่ `/manage/users` → กำหนด role + แผนก → กด "อนุมัติ" (`ACTIVE`) หรือ "ปฏิเสธ" (`DISABLED`)
7. ส่ง email แจ้งผู้สมัคร
8. User กลับมา login ครั้งต่อไปใช้งานได้ปกติ

### 4.2 Login

- ด้วย **email + password**
- Session: HTTP-only cookie (HMAC-signed), อายุ 30 วัน
- Login ผิดติด 5 ครั้ง → ล็อก 15 นาที (`User.lockedUntil`)

### 4.3 ลืมรหัสผ่าน

1. User กรอก email ที่ `/auth/forgot-password`
2. ระบบสร้าง `PasswordResetToken` (hash เก็บใน DB) อายุ **30 นาที, ใช้ได้ครั้งเดียว**
3. ส่ง email พร้อมลิงก์
4. User คลิกลิงก์ → `/auth/reset-password` → กรอกรหัสใหม่
5. Token ถูก mark `usedAt`

### 4.4 Admin reset password
Admin ที่ `/manage/users` กด "รีเซ็ตรหัสผ่าน" → ตั้งรหัสใหม่ให้ user โดยตรง

---

## 5. ประเภทธุรกรรม (Transaction Types)

### 5.1 Workflow transactions (ผ่าน approval route)

| ประเภท | เลขเอกสาร | ใครสร้างได้ | ผลต่อยอดในคลัง |
|---|---|---|---|
| **ISSUE** (เบิกออก) | `PL-ISS-YYMM-NNNN` | REQUESTER / ADMIN | − `condition` (default `GOOD`) |
| **RETURN** (คืนเข้า) | `PL-RET-YYMM-NNNN` | REQUESTER / ADMIN | + `condition` (เลือก 1 สภาพ/ใบ) |

**กฎการเบิก (ISSUE):**
- สภาพ default = `GOOD`
- ตรวจยอด 2 จังหวะ:
  - **ตอนส่งคำขอ** → ถ้าเกินยอดคงเหลือ → แสดง **คำเตือน** แต่ส่งคำขอได้
  - **ตอนอนุมัติขั้นสุดท้าย (PENDING_WAREHOUSE)** → ถ้าเกิน → **อนุมัติไม่ได้** (เนื่องจาก `moveStock()` throw)
- Soft-reserve: คำขอ ISSUE ที่ `PENDING_DEPT` / `PENDING_WAREHOUSE` → หัก available จริง (ยอดคลัง − reserved)

**กฎการคืน (RETURN):**
- ผู้ร้องขอต้อง **เลือก 1 สภาพต่อใบคำขอ** (ไม่ให้คืนหลายสภาพรวมกันในใบเดียว)
- **ไม่บล็อก** แม้แผนกคืนเกินยอดเบิกสะสม (BR-3) — เพราะช่วงเริ่มใช้ระบบพาเลทกระจายอยู่ตามแผนกโดยไม่มีบันทึก
- 1 คำขอมีได้หลาย `RequestItem` (เช่น พาเลทไม้ 50 ใบ + พลาสติก 30 ใบ ในใบเดียว) ตราบใดที่สภาพเดียวกัน

### 5.2 Warehouse operations (ไม่ผ่าน approval route)

| ประเภท | เลขเอกสาร | ใครทำได้ | ผลต่อยอดในคลัง |
|---|---|---|---|
| **REPAIR_RESULT** (ผลซ่อม) | `WO-REP-YYMM-NNNN` | PALLET_MANAGER | PENDING_REPAIR − total, GOOD + repaired, DAMAGED + damaged |
| **WRITE_OFF** (ตัดจำหน่าย) | `WO-WOF-YYMM-NNNN` | PALLET_MANAGER | − condition (ปกติ `DAMAGED`) |
| **ADJUSTMENT** (ปรับยอด) | `WO-ADJ-YYMM-NNNN` | ADMIN | ± quantity (ด้านใดด้านหนึ่งต้องเป็นคลัง) |

**หมายเหตุสำคัญ:**
- **การรับพาเลทใหม่เข้าคลัง** ปัจจุบัน **ใช้ `ADJUSTMENT`** โดยกำหนด `toDepartment = คลัง` (ยังไม่มีประเภท `NEW_STOCK` แยก — เลื่อนไป Phase 2)
- **ผลซ่อม (REPAIR_RESULT)** ครั้งเดียวบันทึก repaired + damaged ได้พร้อมกัน; รวมกันต้องไม่เกินยอด `PENDING_REPAIR`

### 5.3 สภาพพาเลท (PalletCondition)

| สภาพ | ภาษาไทย | ความหมาย |
|---|---|---|
| `GOOD` | ดี | ใช้งานได้ปกติ |
| `PENDING_REPAIR` | รอซ่อม | ต้องส่งซ่อม — ยังอยู่ในคลัง |
| `DAMAGED` | เสีย | รอตัดจำหน่าย — ยังอยู่ในคลัง |

---

## 6. โครงสร้างแผนก (Departments)

### 6.1 แผนก
- **คลังพาเลท** — มี flag `isWarehouse = true` ต้องมี **1 แผนกเท่านั้น**
- แผนกอื่น ๆ เช่น ผลิต, พัสดุ, จ่ายสินค้า, QA, RD (Admin เพิ่มได้ไม่จำกัด)
- Soft-delete ด้วย `active = false`

### 6.2 Section
- ย่อยภายใต้แผนก (`DepartmentSection.departmentId`)
- ไม่มี nested section (flat 1 level)
- ตัวอย่าง: แผนกผลิต → sections = `Alpha 1`, `Alpha 2`, `Beta 1`, `Mixer`, `Packer`

### 6.3 Section ของผู้ใช้
- User ผูกกับ `departmentId` + `sectionId` (optional)
- ตอนสร้างคำขอ ระบบ **snapshot** section ปัจจุบันของ requester ลง `Request.fromSectionId` / `toSectionId`
  → ถ้า user ย้าย section ภายหลัง ประวัติเดิมไม่เปลี่ยน

---

## 7. Approval Workflow

### 7.1 Approval Route (ตั้งค่าโดย Admin)

Admin กำหนด route **รายแผนก × ประเภทคำขอ** (ISSUE/RETURN) ที่ `/manage/approval-routes`

- 1 route = **หลาย step** (เรียงลำดับ `stepOrder` 1, 2, 3, …)
- ขั้นสุดท้าย = `PALLET_MANAGER` (ระบบเติมโดย implicit — ไม่ต้องกำหนด)
- แต่ละ step ตั้งชื่อ (เช่น "หัวหน้ากะ", "ผู้จัดการแผนก") และ **approver เป็นกลุ่ม** (`approverIds: string[]`)
- Approver ในกลุ่มเดียวกัน — ใครอนุมัติก็ได้ 1 คน (ถือว่าผ่าน step นั้น)
- จำนวน step สูงสุด = **10**
- ถ้าแผนกไม่มี route สำหรับประเภทที่ขอ → **สร้างคำขอไม่ได้** (service throw)

### 7.2 State Machine

```
                                 approve step N (dept)             approve (warehouse)
DRAFT* ──submit──▶ PENDING_DEPT ───────────────────▶ PENDING_WAREHOUSE ──────▶ COMPLETED
                        │                                     │                     ▲
                        │          reject                     │  reject or          │
                        │                                     │  edit & approve ────┘
                        ▼                                     ▼
                     REJECTED                              REJECTED
                        │
    cancel (requester)  ▼
                     CANCELLED
```

> *DRAFT: schema รองรับ แต่ปัจจุบัน UI สร้างเป็น `PENDING_DEPT`/`PENDING_WAREHOUSE` ทันที (ไม่มีปุ่ม "บันทึกร่าง")

### 7.3 Snapshot ของ route
เมื่อ submit คำขอ ระบบคัดลอก `[{stepOrder, name, approverIds}]` ลง `Request.stepSnapshot` (JSON)
→ แก้ route ภายหลัง **ไม่กระทบ** คำขอที่ค้างอยู่

### 7.4 Pallet Manager actions (ที่ step สุดท้าย)

1. **Approve** → ยอดคลังเปลี่ยนทันที, สถานะ → `COMPLETED`, ส่ง email แจ้ง requester
2. **Reject** → ต้องกรอกเหตุผล, สถานะ → `REJECTED`
3. **Edit & Approve** → แก้ items + reason → บันทึก `RequestRevision` (before/after), ยอดคลังเปลี่ยนตามค่าใหม่, สถานะ → `COMPLETED`

### 7.5 Cancel โดย Requester
- Requester ยกเลิกคำขอตัวเองได้ **ก่อนมีผู้อนุมัติคนแรก** (ไม่มี `Approval` record ยัง)
- Admin ยกเลิกคำขอใครก็ได้ (ตราบใดที่สถานะยัง `PENDING_*`)

### 7.6 กฎการแบ่งงาน (บังคับที่ service)
- `requesterId !== approverId` ทุก step
- 1 คนห้ามอนุมัติ 2 step เดียวกันในคำขอเดียว (เช่น ถ้า approver อยู่ทั้ง step 1 และ step 2 ของแผนกเดียวกัน — อนุมัติ step 1 ไปแล้ว ห้ามอนุมัติ step 2)
- Pallet Manager อนุมัติได้แม้ตนไม่อยู่ใน route (เพราะเป็น final step โดย default)

---

## 8. ช่วงเวลาทำรายการ (Operating Hours)

### 8.1 การตั้งค่า
Admin ตั้งที่ `/manage/operating-hours`:
- รายวันในสัปดาห์ (0=อาทิตย์, 1=จันทร์, ..., 6=เสาร์)
- หลายช่วง/วัน (เช่น จ–ศ: 09:00–11:30 และ 13:00–15:00)
- ป้ายกำกับ (optional): เช่น "ช่วงเช้า"
- Soft-delete

### 8.2 Holiday
Admin ตั้งวันหยุดพิเศษ (สงกรานต์, ปีใหม่, วันหยุดบริษัท) ที่ `/manage/operating-hours` (tab วันหยุด)

### 8.3 กฎการตรวจ
- ใช้ **เวลา server** โซน Asia/Bangkok (ไม่ใช้ client clock)
- ตรวจตอน **submit คำขอ** → ถ้านอกเวลา/วันหยุด → **บล็อก** พร้อมแสดงเวลาเปิดถัดไป
- การ **อนุมัติ** ทำได้ทุกเวลา (ไม่ถูกจำกัด)
- ปัจจุบัน **ไม่มี** ตัวเลือก "ส่งแบบด่วน" (urgent request) — ถูกเลื่อนไป Phase 2

---

## 9. หน้าจอ (Pages) & User Journeys

### 9.1 Public pages
| Route | หน้า | ใครเข้าได้ |
|---|---|---|
| `/` | Landing / เลือกพอร์ทัล | ทุกคน |
| `/auth/login` | เข้าสู่ระบบ | ทุกคน |
| `/auth/register` | สมัครสมาชิก | ทุกคน |
| `/auth/forgot-password` | ขอ reset | ทุกคน |
| `/auth/reset-password` | reset password ด้วย token | ทุกคน (ที่มีลิงก์) |

### 9.2 Employee Portal (`/app/*`)
| Route | หน้า | รายละเอียด |
|---|---|---|
| `/app` | หน้าแรก | สรุปสถานะเวลาทำการ, คำขอล่าสุด, shortcuts |
| `/app/requests` | รายการคำขอของฉัน | List + filter |
| `/app/requests/new` | สร้างคำขอใหม่ | ISSUE/RETURN, items, attachments |
| `/app/requests/[id]` | รายละเอียดคำขอ | Timeline, revisions, actions |
| `/app/approvals` | คิวรออนุมัติ | สำหรับ DEPT_APPROVER/PALLET_MANAGER |
| `/app/approvals/history` | ประวัติที่ฉันอนุมัติ | |
| `/app/balance` | ยอดในคลัง | รายประเภท × สภาพ (ดูอย่างเดียว) |
| `/app/dashboard` | Dashboard ย่อย | KPI ปัจจุบัน |
| `/app/warehouse-ops` | จัดการคลัง | REPAIR_RESULT, WRITE_OFF (เฉพาะ PALLET_MANAGER) |

### 9.3 Admin Console (`/manage/*`)
| Route | หน้า |
|---|---|
| `/manage` | Dashboard (เต็ม + export Excel) |
| `/manage/requests` | ดูคำขอทั้งหมด (admin) |
| `/manage/requests/[id]` | รายละเอียด + แก้ไข |
| `/manage/users` | จัดการ user + อนุมัติสมาชิก |
| `/manage/departments` | จัดการแผนก |
| `/manage/pallet-types` | จัดการประเภทพาเลท |
| `/manage/approval-routes` | ตั้ง approval route รายแผนก |
| `/manage/operating-hours` | ช่วงเวลา + วันหยุด |
| `/manage/adjustments` | ปรับยอด (ADJUSTMENT) |
| `/manage/audit-logs` | Audit log |

### 9.4 User journey หลัก

**A. REQUESTER สร้างคำขอเบิก (ISSUE)**
```
/app → "สร้างคำขอ" → เลือก tab "เบิก"
  → เลือกประเภทพาเลท + จำนวน (1..n รายการ)
  → (optional) neededDate, purpose, note, แนบรูป
  → กด "ส่ง"
  → ระบบตรวจเวลาทำการ → ถ้าในเวลา: submit
  → ระบบตรวจ route ของแผนก → ถ้ามี: snapshot steps → PENDING_DEPT
  → ระบบตรวจยอดคลัง → ถ้าไม่พอ: แสดง warning (ยังส่งได้)
  → แจ้ง approver ของ step 1 (email + in-app)
```

**B. DEPT_APPROVER อนุมัติ**
```
Email "คำขอใหม่รออนุมัติ PL-ISS-2610-0001" → คลิกลิงก์
  → /app/requests/[id] → ดูรายละเอียด → ปุ่ม "อนุมัติ" / "ปฏิเสธ"
  → ถ้าอนุมัติ: เลื่อนไป step ถัดไป
  → ถ้าเป็น step สุดท้ายของ route → PENDING_WAREHOUSE
  → ถ้าปฏิเสธ: ต้องกรอกเหตุผล → REJECTED
```

**C. PALLET_MANAGER อนุมัติขั้นสุดท้าย**
```
/app/approvals → คลิกคำขอ → เห็น warning (BR-2 / BR-3) ถ้ามี
  → เลือกระหว่าง "อนุมัติ" / "ปฏิเสธ" / "แก้ไขแล้วอนุมัติ"
  → อนุมัติ → moveStock() → COMPLETED → email → requester
```

**D. PALLET_MANAGER บันทึกผลซ่อม**
```
/app/warehouse-ops → tab "ผลซ่อม"
  → เลือกประเภทพาเลท + กรอก repairedQty + damagedQty + note
  → กด "บันทึก"
  → ระบบ -PENDING_REPAIR total, +GOOD repaired, +DAMAGED damaged (atomic)
  → สร้าง WarehouseOperation + StockMovements (3 แถวใน group เดียวกัน)
```

**E. ADMIN ปรับยอด**
```
/manage/adjustments → form
  → เลือกประเภทพาเลท, condition, from/to department, quantity, reason (บังคับ)
  → กด "ปรับยอด"
  → ถ้า to = คลัง → +qty (เช่น รับพาเลทใหม่)
  → ถ้า from = คลัง → -qty (เช่น ลดยอดจากการนับ)
  → สร้าง WarehouseOperation(type=ADJUSTMENT) + StockMovement
```

---

## 10. Dashboard (Reports)

### 10.1 KPI หลัก (บน `/manage`)
- ยอดในคลัง รายประเภท × สภาพ (GOOD / PENDING_REPAIR / DAMAGED)
- จำนวนคำขอรออนุมัติ แยกตามขั้น
- การเคลื่อนไหวคลัง 30 วันล่าสุด (เบิก, คืน, ผลซ่อม, ตัดจำหน่าย, ปรับยอด)
- สถิติแยกแผนก (ยอดเบิก, ยอดคืน, สัดส่วนคืนสภาพเสีย/รอซ่อม)

### 10.2 Filters
- ช่วงวันที่ (date range)
- แผนก / section
- ประเภทพาเลท
- สภาพพาเลท

### 10.3 Export Excel
- ปุ่ม "Export Excel" (ที่ `/manage` และหน้าอื่น)
- ไฟล์ `.xlsx` ใช้ `exceljs`
- หัวคอลัมน์ภาษาไทย, ตัวเลขเป็นตัวเลขจริง (ไม่ใช่ text), วันที่ format `dd/MM/yyyy HH:mm` โซน Asia/Bangkok

---

## 11. การแจ้งเตือน

### 11.1 ช่องทาง
- **In-app** (`Notification` table) — ตารางเก็บทุก notification; แสดงใน UI (เช่น icon กระดิ่ง)
- **Email** (`EmailOutbox` table + cron job) — Gmail SMTP via nodemailer

### 11.2 Trigger

| เหตุการณ์ | ผู้รับ | ช่องทาง |
|---|---|---|
| สมัครสมาชิกใหม่ | Admin ทุกคน | in-app + email |
| สมัครสมาชิกใหม่ | ผู้สมัคร (confirm) | email |
| อนุมัติ/ปฏิเสธสมาชิก | ผู้สมัคร | in-app + email |
| คำขอใหม่ รอ step 1 | Approver ของ step 1 | in-app + email |
| คำขอเลื่อนไป step N | Approver ของ step N | in-app + email |
| คำขอเลื่อนไป PENDING_WAREHOUSE | PALLET_MANAGER ทุกคน | in-app + email |
| คำขออนุมัติแล้ว (COMPLETED) | Requester | in-app + email |
| คำขอถูกปฏิเสธ | Requester | in-app + email |
| คำขอถูกแก้ไข&อนุมัติ | Requester | in-app + email |

### 11.3 ความถี่
- Email ส่งผ่าน cron job ที่เรียก `/api/cron/send-emails` (ทุก 1 นาที)
- Outbox pattern — ถ้าส่งไม่สำเร็จ ไม่ทำให้การอนุมัติล้มเหลว, email อยู่ใน status `FAILED` + `lastError`

---

## 12. Business Rules (BR)

ดูรายละเอียดและ test case ที่ `SPEC.md §9` และ `SPEC.md §15` (Acceptance Criteria)

- **BR-1** — ยอดในคลังของทุก (ประเภท × สภาพ) ต้องไม่ติดลบ
- **BR-2** — ISSUE: ยอดไม่พอ ตอนส่งคำขอ **เตือน** (ส่งได้); ตอนอนุมัติขั้นสุดท้าย **บล็อก**
- **BR-3** — RETURN คืนเกินยอดเบิกสะสม → ไม่บล็อก แต่ **แสดงคำเตือน**
- **BR-4** — ทุกคำขอ: อย่างน้อย 1 item, quantity > 0, RETURN ต้องเลือก 1 สภาพ
- **BR-5** — การเปลี่ยนยอดทุกครั้ง ต้องเขียน ledger (StockMovement) + update snapshot (WarehouseStock/DepartmentStock) ใน **transaction เดียวกัน**
- **BR-6** — Ledger เป็น append-only; แก้ย้อนหลังต้องผ่าน ADJUSTMENT
- **BR-7** — WRITE_OFF และ ADJUSTMENT ต้องมีเหตุผล
- **BR-8** — User status ≠ `ACTIVE` → เข้าใช้งานไม่ได้ (ยกเว้นหน้า register/status)
- **BR-9** — Master data (department, pallet type, user) ใช้ soft-delete เท่านั้น ถ้ามีประวัติ
- **BR-10** — คำขอส่งได้เฉพาะในช่วงเวลาทำรายการ (ไม่มีด่วนใน v1.0)

---

## 13. Non-Functional Requirements

### 13.1 Compatibility
- Browser modern: Chrome, Edge, Safari (รองรับ 2 เวอร์ชันล่าสุด)
- Responsive: ทดสอบที่ 375px (mobile), 768px (tablet), 1280px (desktop) — ไม่มี horizontal scroll
- ภาษา UI: **ไทย** 100% (เมนู, label, message, email)
- ฟอนต์: **Noto Sans Thai** (next/font/google)

### 13.2 Performance
- หน้าทั่วไปโหลด < 2 วินาที บน 4G
- Dashboard query < 3 วินาที ที่ข้อมูล 1 ปี
- Email ส่งใน 1 นาทีหลังสร้าง (cron ทุกนาที)

### 13.3 Security
- Password hash: scrypt (salt per user, 64-byte key)
- Session: HMAC-SHA256 signed cookie, HTTP-only, Secure (production), SameSite=lax
- ตรวจสิทธิ์ที่ server **ทุก API route** และ **ทุก Server Component** — ห้ามพึ่งการซ่อนปุ่ม
- Rate limit login: 5 ครั้ง/15 นาที/user
- CSRF: SameSite=lax cookies + method check
- Secret management: `.env` เท่านั้น — ห้าม commit

### 13.4 Data retention
- `AuditLog` — เก็บถาวร
- `StockMovement` — เก็บถาวร
- Operational data (Request, Approval, Notification) — เก็บ 5 ปี
- `EmailOutbox` — เก็บ 90 วัน (sent + failed)

### 13.5 Availability
- Target: 99% (Vercel SLA + Supabase SLA)
- Cron จำกัดใน Vercel Hobby (1/day) → ปัจจุบันต้องใช้ paid plan หรือ external cron (ดู README)

### 13.6 PDPA (Thailand)
- เก็บ email + ชื่อ-นามสกุล + เบอร์โทร
- Privacy notice ในหน้าสมัคร (ยืนยันก่อนส่ง)
- Admin ลบบัญชี user ได้ (soft-delete → `DISABLED`); ลบจริงเฉพาะกรณีไม่มีประวัติ

---

## 14. ความเสี่ยง & การรับมือ

| ความเสี่ยง | ผลกระทบ | การรับมือ |
|---|---|---|
| ผู้ใช้ลืมคืนพาเลท ยอดนอกคลังพองขึ้น | Op efficiency | Dashboard แสดง "คืนเกินยอดเบิก" ตามแผนก (Phase 2 มี aging report) |
| Pallet Manager อนุมัติโดยไม่ได้ส่งจริง | Data integrity | Audit log + ปุ่ม "แก้ไขและอนุมัติ" บังคับเหตุผล; admin สุ่มตรวจ |
| Gmail SMTP quota (500 email/day) | แจ้งเตือนล่าช้า | ใช้ in-app notification เป็น fallback; เตรียม switch เป็น SendGrid/Resend ได้ (service abstract) |
| Admin เผลอลบแผนกที่มี user อยู่ | FK broken | Soft-delete + check `User.department.active` ก่อนใช้ |
| คำขอค้าง approver คนเดียวที่ลาออก | Workflow stuck | Admin ตรวจ `checkApproverRouteConflict` ก่อน disable user |
| Clock skew ระหว่างเครื่อง user กับ server | Operating hours ผิด | ใช้เวลา server (Asia/Bangkok) เสมอ |

---

## 15. ประวัติเวอร์ชัน

| เวอร์ชัน | วันที่ | สรุป |
|---|---|---|
| 0.2.x | 2026-09-30 | สเปคแรก มี location table |
| 0.3.x | 2026-10-01 | ลดเหลือ binary in/out tracking |
| 0.4.0 | 2026-10-02 | Drop locations, ใช้ dept/section |
| 0.5.0 | 2026-10-10 | เปลี่ยน auth จาก LINE LIFF เป็น email + password |
| 0.6.0 | 2026-10-15 | Multi-step approval + email outbox |
| **1.0.0** | **2026-10-21** | **เอกสารนี้ — สอดคล้อง implementation ปัจจุบัน; รับเข้าใหม่ใช้ ADJUSTMENT; ไม่มี urgent request** |
