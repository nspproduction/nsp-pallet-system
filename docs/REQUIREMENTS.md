# ระบบเบิกจ่ายพาเลท — Requirement Specification

เวอร์ชัน: 0.4.0 (MVP เฟส 1 — dept/section routing + registration flow, 2026-10-02)
ผู้จัดทำ: Noritake

---

## 1. บริบทและเป้าหมาย

โรงงานมีการหมุนเวียนพาเลทผ่านหลายแผนก (คลังพาเลท, ผลิต, พัสดุ, จ่ายสินค้า, QA, RD) ปัจจุบันบันทึกด้วยกระดาษ ทำให้ยอดเพี้ยน หาพาเลทไม่เจอ ตามคืนไม่ทัน

**ลูกค้าไม่ได้ร้องขอพาเลทโดยตรง** — ผู้ร้องขอทุกคำขอคือแผนกภายใน flow จริงในโรงงาน:

```
คลังพาเลท ─(ผลิตเบิก)─▶ ไลน์ผลิต ─(วางสินค้า โอนภายใน)─▶ จ่ายสินค้า ─(ส่งพร้อมสินค้า)─▶ ลูกค้า
ลูกค้า ─(รอบถัดไปเอาพาเลทเก่ามาคืน)─▶ จ่ายสินค้า ─(จ่ายสินค้าคืน)─▶ คลังพาเลท
```

**โมเดลติดตาม (MVP เฟส 1):** ระบบรู้สถานะพาเลท 2 ค่า — **ในคลัง** หรือ **นอกคลัง** การย้ายระหว่างแผนก (ไลน์ผลิต → จ่ายสินค้า, จ่ายสินค้า → ลูกค้า) ไม่บันทึกเพราะเพิ่มภาระ operation โดยไม่คุ้ม

**ขยายในอนาคต:** schema เก็บ `fromDepartmentId / toDepartmentId / fromSectionId / toSectionId` ครบ เฟสถัดไปอยากเปิด per-dept balance คำนวณจาก ledger เดิมได้ ไม่ต้อง migrate

**เป้าหมาย**
1. รู้ตลอดเวลาว่า พาเลทแต่ละประเภท × สถานะ อยู่ในคลัง / นอกคลัง จำนวนเท่าไร
2. เบิก-คืน-ซ่อม ผ่านมือถือใน LINE ได้ทุกขั้นตอน
3. มีร่องรอยการอนุมัติและปรับยอด ตรวจสอบย้อนหลังได้
4. breakdown "นอกคลังอยู่กับใคร" ตามแผนก/section เพื่อเตือนตามคืน

## 2. ขอบเขต (Scope)

**In scope (เฟส 1 — MVP)**
- LINE LIFF สำหรับหน้างาน · Web Admin
- ลงทะเบียนครั้งแรกใน LIFF (ชื่อ-นามสกุล / เบอร์โทร / แผนก + section) · admin กด active ถึงจะใช้ได้
- สร้าง / อนุมัติ / ยืนยันส่งมอบคำขอ 3 ประเภท UI (รับเข้าใหม่, เบิกออก, คืนเข้า) + admin WRITE_OFF/ADJUSTMENT
- Balance 2 ค่า: **ในคลัง (แยกประเภท × สถานะ)** และ **นอกคลังรวม**
- Dashboard: ยอดในคลัง, ยอดนอกคลังรวม, รอซ่อม, คำขอรออนุมัติ, ตัดจำหน่าย 30 วัน
- บันทึก "เบิก/คืน รายแผนก × section" ใน movement log · ใช้ทำ report ได้
- Admin จัดการ pallet_types / departments / sections / users
- Audit log ทุกการเปลี่ยนแปลง
- แนบรูปในคำขอ (Supabase Storage)
- LINE Messaging API แจ้ง approver เมื่อมีคำขอใหม่ (รอเปิดใช้งานด้วย token)

**Out of scope (เฟส 1)**
- Per-department balance (ยอดคงเหลือแยกตามแผนก เช่น "ไลน์ A ถือพาเลทไม้กี่ตัว") · schema เตรียมพร้อม แต่ไม่คำนวณ/ไม่โชว์
- การย้ายพาเลทระหว่างแผนกภายในที่ไม่ผ่านคลัง (TRANSFER_INTERNAL)
- การ track SUPPLIER / CUSTOMER / REPAIR_SHOP (ลบ `locations` ทั้งหมดแล้ว)
- QR per-unit tracking
- Multi-step approval
- Export Excel / Statement
- ERP integration

**เฟส 2**
- Per-department balance (คำนวณจาก ledger เดิม)
- บันทึก TRANSFER_INTERNAL ระหว่างแผนก
- Multi-step approval configurable
- Aging report + auto-alert ยอดค้างเกิน SLA

**เฟส 3**
- QR per-unit
- ERP integration

## 3. บทบาทผู้ใช้ (Roles) และสถานะ

| Role | ทำอะไรได้ | เข้าจากไหน |
|---|---|---|
| Requester  | สร้างคำขอเบิก/คืน, ยกเลิกของตัวเองก่อนอนุมัติ, ดูสถานะ | LIFF |
| Approver   | อนุมัติ/ปฏิเสธคำขอ พร้อมเหตุผล | LIFF |
| Store      | ยืนยันส่งมอบ/รับของจริง, กรอกยอดจริงถ้าไม่ตรง | LIFF |
| Admin      | จัดการข้อมูลหลัก, ผู้ใช้, ปรับยอด, ตัดจำหน่าย, ดู Audit log | Web |
| Viewer     | ดู Dashboard อ่านอย่างเดียว | Web |

**สถานะผู้ใช้ (`UserStatus`):**
- `PENDING` — เพิ่งลงทะเบียน รอ admin อนุมัติ · UI โชว์ **"กำลังรอการอนุมัติการลงทะเบียนโดยแอดมิน"**
- `ACTIVE` — ใช้งานได้ปกติ
- `DISABLED` — ถูกระงับ · UI โชว์ **"บัญชีของคุณถูกระงับชั่วคราว"**

**กฎการแบ่งงาน (บังคับที่ระดับระบบ):**
- `requesterId !== approverId` — คนเดียวกันอนุมัติคำขอของตัวเองไม่ได้
- `requesterId !== storeId` ตอน fulfill
- **"รับเข้าใหม่" สร้างได้โดย department `WH` (พัสดุ) เท่านั้น** — บล็อกใน `createRequest`

## 4. การลงทะเบียน (First-time registration)

```
LINE login (LIFF) → /api/auth/line สร้าง user stub (PENDING, ไม่มี phone/dept)
  → /api/auth/me ส่ง needsRegistration=true
  → redirect /liff/register
  → user กรอก ชื่อ-นามสกุล / เบอร์โทร / แผนก / section (ถ้ามี)
  → /api/auth/register บันทึก, status ยังเป็น PENDING
  → หน้า "กำลังรอการอนุมัติ"
  → admin ไปที่ /admin/users กด ACTIVE
  → user เปิด LIFF ครั้งต่อไป → ใช้งานได้ปกติ
```

**ข้อมูลที่เก็บจาก LINE:** `lineUserId` (unique), `displayName` ตอนแรก (user แก้ได้)
**ไม่เก็บ:** email (ลบจาก schema แล้ว), รูปโปรไฟล์ LINE (อ่าน runtime เท่านั้น ไม่เก็บ)

## 5. ประเภทรายการ (Transaction Types)

**UI เฟส 1 ให้ผู้ใช้ทั่วไปเลือก 3 ประเภท:**

| ประเภท (UI) | enum ใน DB | from → to (dept) | ผลต่อยอดในคลัง | ใครสร้างได้ |
|---|---|---|---|---|
| **1. รับเข้าใหม่** | `RECEIVE_NEW` | — → WH-PL | +USABLE | **แผนก `WH` เท่านั้น** |
| **2. เบิกออก** | `ISSUE_INTERNAL` | WH-PL → requester.dept[+section] | − USABLE | ทุกแผนก |
| **3. คืนเข้า** | `RETURN_INTERNAL` | requester.dept[+section] → WH-PL | + ตามสภาพที่เลือก | ทุกแผนก |

**UI ไม่ถามต้นทาง/ปลายทาง** — backend อ่าน `user.departmentId` + `user.sectionId` แล้ว routing อัตโนมัติ

### 5.1 สภาพพาเลทตอน "คืนเข้า"

ผู้ร้องขอต้องเลือก 1 สภาพต่อคำขอ:

| สภาพ (UI) | `PalletCondition` | ผลต่อยอดในคลัง |
|---|---|---|
| ดี | `USABLE` | +ยอดใช้งานได้ |
| ส่งซ่อม | `IN_REPAIR` | +ยอดรอซ่อม (ยังอยู่ในคลัง) |
| เสีย | `UNUSABLE` | +ยอดเสีย (ยังอยู่ในคลัง รอ admin ตัดจำหน่าย) |

**กฎ:** หากผู้ร้องขอมีของต้องคืนหลายสภาพพร้อมกัน → สร้างคำขอแยกใบ (`createRequest` validator บล็อก mixed condition ในใบเดียวกัน)

### 5.2 ประเภทที่ admin-only (ไม่โชว์ใน LIFF)

| ประเภท | เมื่อไร |
|---|---|
| `WRITE_OFF` | ตัดพาเลทสภาพ `UNUSABLE` ที่ค้างในคลัง — ต้องมีเหตุผล |
| `ADJUSTMENT` | หลังนับสต็อกจริง มีเหตุผล · เขียน `stock_movement` ตรง (bypass workflow) |

### 5.3 Enum values ที่เก็บไว้ใน schema แต่ไม่ใช้ใน UI

`TRANSFER_INTERNAL`, `SHIP_CUSTOMER`, `RETURN_CUSTOMER`, `SEND_REPAIR`, `RECEIVE_REPAIR` — เผื่อเฟสถัดไปเปิด per-location/customer tracking

**ข้อสังเกต:** "เบิกออก" และ "คืนเข้า" มีหลายบรรทัดต่อคำขอได้ (เบิกพาเลทไม้ 50 + พลาสติก 30 ในใบเดียว) แต่ **"คืนเข้า" ทุกบรรทัดต้องเป็นสภาพเดียวกัน**

## 6. Workflow ของคำขอ

```
         ผู้ร้องขอกด "ส่ง"       Approver           Store
new  ──────────────────────▶  PENDING  ─────▶  APPROVED  ─────▶  FULFILLED
                                 │                │
                                 │                └─ REJECTED (มีเหตุผล)
                                 └─ CANCELLED (ผู้ร้องขอก่อนอนุมัติ)
```

- **สต็อกเปลี่ยนตอน FULFILLED เท่านั้น** · Store กรอก `actualQuantity` ของแต่ละ `request_item` (อาจต่างจากที่ขอ) · ค่าถูกเขียนเป็น `stock_movement`
- **เลขเอกสาร** (`docNo`): auto generate ตาม pattern `PL-<TYPE_CODE>-<yymm>-<seq>` เช่น `PL-OUT-2610-0001` · ใช้ตาราง `doc_counters` เป็น sequence atomic

**การจองยอด (soft-reserve):**
คำขอที่หักยอดคลัง (`ISSUE_INTERNAL`, `WRITE_OFF`) สถานะ `PENDING`/`APPROVED` → หัก available ที่ WH-PL ก่อนที่ movement จะเกิดจริง

```
Available at WH-PL = SUM(movements in/out at WH-PL) − SUM(request_items.quantity ที่ยัง PENDING/APPROVED)
```

RETURN_INTERNAL **ไม่** reserve dept balance (เฟส 1 ไม่ track dept balance)

## 7. โครงสร้างแผนก (Departments / Sections)

**แผนก** (ตาราง `departments`):
- `WH-PL` — คลังพาเลท · เป็น "คลัง" ของระบบ · APPROVER + STORE ประจำที่นี่
- `WH` — พัสดุ · เป็น requester ที่สร้าง RECEIVE_NEW ได้คนเดียว
- `PD` — ผลิต · มี sections (Alpha 1-4, Beta 1-3, ...)
- `DISP` — จ่ายสินค้า
- `QA` — ควบคุมคุณภาพ
- `RD` — เทคโนโลยี

**Section** (ตาราง `department_sections`): sub-group ของแผนก unique `(departmentId, code)` · มี `active` flag

**ไม่มีแล้ว (ลบตั้งแต่ 0.4.0):** ตาราง `locations`, enum `LocationType`, concept SUPPLIER/CUSTOMER/REPAIR_SHOP · ทุก from/to ของ movement ใช้ `departmentId + sectionId`

## 8. ข้อมูลในคำขอ

**ดึงอัตโนมัติ:**
- `docNo` (ดู §6)
- `requesterId` (จาก session), `requester.departmentId`, `sectionId` (snapshot จาก user ปัจจุบัน)
- `fromDepartmentId / toDepartmentId / fromSectionId / toSectionId` — service กำหนดตามประเภท

**ผู้ใช้กรอก (LIFF):**
- ประเภท (3 tabs)
- สภาพ (เฉพาะ "คืนเข้า")
- Section override (ถ้าแผนกมี section)
- รายการพาเลท: ประเภท × จำนวน (หลายบรรทัดได้)
- วันที่ต้องการ
- วัตถุประสงค์
- รูปแนบ (optional, multiple, รองรับ camera capture)

**ลบจาก UI (เฟส 1):** `referenceNo` (เลข PO/DO) — ยัง optional ใน schema

## 9. การแจ้งเตือน

**LINE Messaging API** (LINE Notify ปิดบริการแล้ว)
- Trigger: `notifyApproversOfNewRequest` ส่ง Flex Message หา approvers ตอนสร้างคำขอใหม่
- สถานะ: โค้ดพร้อม · รอตั้ง `LINE_CHANNEL_ACCESS_TOKEN` ใน env

**เฟส 2:**
- แจ้งผู้ร้องขอเมื่ออนุมัติ/ปฏิเสธ/ยืนยัน
- แจ้งเมื่อยอดต่ำกว่า `minStock`
- แจ้งเตือนยอดค้างเกิน SLA

## 10. Dashboard (เฟส 1)

**KPI:**
- พาเลทในคลัง (ที่ WH-PL, แยกประเภท × สภาพ) — ค่าหลัก
- พาเลทนอกคลังรวม (sum ของ movements to-dept-ที่ไม่ใช่-WH-PL)
- รอซ่อม (ที่ WH-PL, condition `IN_REPAIR`)
- คำขอรออนุมัติ
- อนุมัติแล้วรอส่งมอบ
- ตัดจำหน่าย 30 วันล่าสุด

**Inline balance ในฟอร์มคำขอ:**
- "เบิกออก" โชว์ **"เบิกได้: N ตัว"** ต่อ (palletType, USABLE) · UI บล็อกถ้าใส่เกิน
- "คืนเข้า" โชว์ **"ในคลังตอนนี้: N ตัว"** ตาม condition ที่เลือก

**ไม่มี (เลื่อนเฟส 2):**
- ยอดค้างแยกแผนก/section
- Aging ลูกค้า
- กราฟแนวโน้ม

## 11. Non-functional

| หัวข้อ | เป้าหมาย |
|---|---|
| Availability | 99% (Vercel + Supabase SLA) |
| Performance | หน้าโหลด < 2s บน 4G |
| Data retention | `audit_logs` ถาวร · operational data 5 ปี |
| PDPA | privacy notice ในหน้าลงทะเบียน LIFF; เก็บ `lineUserId` + ชื่อ-นามสกุล + เบอร์โทร; ลบเมื่อ user ถูกปิดบัญชี |
| Auth | ตรวจ LINE ID token / session cookie HTTP-only · PENDING user ยัง login ได้แต่เข้าแค่หน้า register/status |
| UI/UX | Font: Noto Sans Thai; Tailwind v4 `@theme`; LIFF-first (max-w-md); Skeleton loader ทุกหน้า |
| Code style | TypeScript strict; grouped imports; `twMerge` สำหรับ conditional classes |

## 12. ความเสี่ยง & การรับมือ

| ความเสี่ยง | การรับมือ |
|---|---|
| ผู้ใช้ลืมคืนพาเลท ยอดนอกคลังพองขึ้น | Dashboard แจ้งเตือน + ปุ่ม "คืนเข้า" กดง่ายใน LIFF |
| Store กด FULFILLED โดยไม่ได้ส่งจริง | ต้องกรอก actualQuantity, audit log เต็ม, Admin สุ่มตรวจ |
| LINE Messaging API quota | ประเมิน volume · fallback เป็น in-app inbox (ตาราง `notifications` รองรับแล้ว) |
| `lineUserId` + เบอร์โทรเป็น PII | PDPA notice · ลบเมื่อปิดบัญชี · session cookie HTTP-only |
| Admin เปลี่ยน code `WH-PL` → ระบบหา warehouse ไม่เจอ | WAREHOUSE_DEPT_CODE constant · มี warning ใน admin UI ตอนแก้ code นี้ |

## 13. ประวัติเวอร์ชัน

| เวอร์ชัน | วันที่ | สรุป |
|---|---|---|
| 0.2.x | 2026-09-30 | สเปคแรก · มี location table, 8 request types ครบ |
| 0.3.0 | 2026-10-01 | ลดเหลือ binary in/out tracking · per-location ย้ายไปเฟส 2 |
| 0.3.1 | 2026-10-01 | UI 3 types + 1-condition-per-return |
| **0.4.0** | **2026-10-02** | **Drop `locations` table ทั้งหมด · ใช้ dept/section แทน · เพิ่ม registration flow + status gates** |
