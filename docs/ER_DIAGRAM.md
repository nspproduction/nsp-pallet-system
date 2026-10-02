# ER Diagram — ระบบเบิกจ่ายพาเลท

Diagram นี้สะท้อนโครงสร้างที่กำหนดใน `prisma/schema.prisma` โดยตรง (ไม่มีตาราง `locations` แล้ว ตั้งแต่ 2026-10-02)

## ภาพรวม

```mermaid
erDiagram
    Department ||--o{ User              : has
    Department ||--o{ DepartmentSection : "has sections"

    DepartmentSection ||--o{ User : "assigned to"

    User ||--o{ Request       : "requests"
    User ||--o{ Approval      : "decides"
    User ||--o{ StoreAction   : "confirms"
    User ||--o{ AuditLog      : "acts"
    User ||--o{ Notification  : "receives"

    PalletType ||--o{ RequestItem   : "typed as"
    PalletType ||--o{ StockMovement : "typed as"

    Department        ||--o{ Request       : "from / to"
    Department        ||--o{ StockMovement : "from / to"
    DepartmentSection ||--o{ Request       : "from / to / requester-snapshot"
    DepartmentSection ||--o{ StockMovement : "from / to"

    Request ||--o{ RequestItem   : "contains"
    Request ||--o{ Approval      : "receives"
    Request ||--o{ StoreAction   : "closed by"
    Request ||--o{ StockMovement : "produces"
    Request ||--o{ Attachment    : "has"

    Department {
      string id PK
      string code UK
      string name
      bool   active
    }

    DepartmentSection {
      string id PK
      string departmentId FK
      string code
      string name
      bool   active
    }

    User {
      string id PK
      string lineUserId UK
      string employeeCode UK
      string fullName
      string phone
      UserRole role
      UserStatus status
      string departmentId FK
      string sectionId FK
    }

    PalletType {
      string id PK
      string code UK
      string name
      string material
      string sizeSpec
      int    minStock
      bool   active
    }

    Request {
      string id PK
      string docNo UK
      RequestType type
      RequestStatus status
      string requesterId FK
      string fromDepartmentId FK
      string fromSectionId FK
      string toDepartmentId FK
      string toSectionId FK
      string sectionId FK
      datetime neededDate
      string purpose
      string referenceNo
      string note
      datetime submittedAt
      datetime approvedAt
      datetime fulfilledAt
      datetime cancelledAt
    }

    RequestItem {
      string id PK
      string requestId FK
      string palletTypeId FK
      PalletCondition condition
      int quantity
      int actualQuantity
      string note
    }

    Approval {
      string id PK
      string requestId FK
      string approverId FK
      ApprovalDecision decision
      string comment
      int step
      datetime decidedAt
    }

    StoreAction {
      string id PK
      string requestId FK
      string userId FK
      StoreActionType action
      string comment
      datetime actedAt
    }

    StockMovement {
      string id PK
      string movementGroupId
      string requestId FK
      string palletTypeId FK
      PalletCondition condition
      int quantity
      string fromDepartmentId FK
      string fromSectionId FK
      string toDepartmentId FK
      string toSectionId FK
      string reason
      datetime occurredAt
    }

    Attachment {
      string id PK
      string requestId FK
      string filePath
      string fileType
      int fileSize
      string uploadedBy
      datetime uploadedAt
    }

    AuditLog {
      string id PK
      string userId FK
      string entity
      string entityId
      string action
      json before
      json after
      datetime createdAt
    }

    Notification {
      string id PK
      string userId FK
      string channel
      string subject
      string body
      datetime sentAt
      string error
    }
```

## Enums

- **`UserRole`** = `REQUESTER` | `APPROVER` | `STORE` | `ADMIN` | `VIEWER`
- **`UserStatus`** = `PENDING` | `ACTIVE` | `DISABLED`
- **`PalletCondition`** = `USABLE` | `IN_REPAIR` | `UNUSABLE`
- **`RequestType`** = `RECEIVE_NEW` | `ISSUE_INTERNAL` | `RETURN_INTERNAL` | `TRANSFER_INTERNAL` | `SHIP_CUSTOMER` | `RETURN_CUSTOMER` | `SEND_REPAIR` | `RECEIVE_REPAIR` | `WRITE_OFF` | `ADJUSTMENT`
  - UI เฟส 1 ใช้แค่ 3 ค่าแรก + 2 ตัวสำหรับ admin (`WRITE_OFF`, `ADJUSTMENT`) · ค่าที่เหลือเก็บไว้สำหรับเฟสถัดไป
- **`RequestStatus`** = `DRAFT` | `PENDING` | `APPROVED` | `FULFILLED` | `REJECTED` | `CANCELLED`
- **`ApprovalDecision`** = `APPROVED` | `REJECTED`
- **`StoreActionType`** = `CONFIRM_DISPATCH` | `CONFIRM_RECEIPT`

## หลักการที่ต้องยึด

1. **`stock_movements` เป็นแหล่งความจริงเดียว**
   ยอดคงเหลือของ `(palletType, condition, department)` = `SUM(in.quantity) − SUM(out.quantity)` เท่านั้น
   ไม่มีตาราง `stock_balances` ให้แก้ไขตรง ๆ

2. **"คลังพาเลท" = Department ที่มี `code = "WH-PL"`**
   ยอดในคลัง = pallets ที่ `toDepartmentId = WH-PL` ลบด้วย `fromDepartmentId = WH-PL`
   ไม่มี Location ชนิด WAREHOUSE อีกต่อไป

3. **"เบิก/คืน" ไม่ถามต้นทาง/ปลายทาง**
   backend อ่าน `user.departmentId` + `user.sectionId` แล้ว routing เอง:
   - `RECEIVE_NEW`: from = null (ไม่มี supplier concept), to = WH-PL
   - `ISSUE_INTERNAL`: from = WH-PL, to = user's dept/section
   - `RETURN_INTERNAL`: from = user's dept/section, to = WH-PL
   `request.sectionId` คือ snapshot ของ `requester.sectionId` ณ เวลาที่สร้าง (ไม่เปลี่ยนถ้า user ย้าย section ภายหลัง)

4. **เปลี่ยนสถานะพาเลทที่คลังเดิม**
   ทำเป็น 2 แถวใน `stock_movements` ที่มี `movementGroupId` เดียวกัน:
   - แถวที่ 1: OUT จาก `(WH-PL, USABLE)`
   - แถวที่ 2: IN ไปที่ `(WH-PL, IN_REPAIR)`
   รักษา invariant "1 แถว = 1 condition"

5. **Soft-reserve**
   คำขอ `ISSUE_INTERNAL` / `WRITE_OFF` สถานะ `PENDING`/`APPROVED` → หัก available ที่คลัง (WH-PL) ก่อนที่ movement จะเกิดจริง
   `RETURN_INTERNAL` ไม่ reserve dept balance เพราะเฟส 1 ไม่ track dept balance

6. **Attachments เก็บใน Supabase Storage**
   ตาราง `attachments` เก็บเฉพาะ path + metadata (fileType / fileSize / uploadedBy) ไม่เก็บ blob

7. **Audit log เขียนจาก service layer เท่านั้น**
   `writeAudit()` ใน `lib/services/audit.ts` เป็นช่องทางเดียว · ห้ามเขียน `audit_logs` ตรง ๆ จาก route handler

8. **Soft-delete ทั้งหมด**
   ตาราง master (pallet_types / departments / department_sections) มีคอลัมน์ `active boolean` ใช้ปิดการใช้งานแทนลบจริง เพื่อรักษา FK ของประวัติ

## Query ตัวอย่าง

**ยอดในคลัง**
```sql
SELECT m.palletTypeId, m.condition,
       SUM(CASE WHEN m."toDepartmentId" = d.id THEN m.quantity ELSE 0 END)
     - SUM(CASE WHEN m."fromDepartmentId" = d.id THEN m.quantity ELSE 0 END) AS on_hand
FROM stock_movements m
JOIN departments d ON d.code = 'WH-PL'
WHERE m."toDepartmentId" = d.id OR m."fromDepartmentId" = d.id
GROUP BY m.palletTypeId, m.condition;
```

**ยอดนอกคลังรวมแยกตามแผนก (ไม่รวม WH-PL)**
```sql
SELECT d.code, d.name,
       SUM(CASE WHEN m."toDepartmentId"   = d.id THEN m.quantity ELSE 0 END)
     - SUM(CASE WHEN m."fromDepartmentId" = d.id THEN m.quantity ELSE 0 END) AS outstanding
FROM stock_movements m
JOIN departments d ON (m."toDepartmentId" = d.id OR m."fromDepartmentId" = d.id)
WHERE d.code <> 'WH-PL'
GROUP BY d.id, d.code, d.name
HAVING SUM(CASE WHEN m."toDepartmentId" = d.id THEN m.quantity ELSE 0 END)
     - SUM(CASE WHEN m."fromDepartmentId" = d.id THEN m.quantity ELSE 0 END) > 0;
```

**คำขอรออนุมัติที่ยัง reserve ยอดคลังอยู่**
```sql
SELECT ri."palletTypeId", ri.condition, SUM(ri.quantity) AS reserved
FROM request_items ri
JOIN requests r ON r.id = ri."requestId"
JOIN departments d ON d.id = r."fromDepartmentId" AND d.code = 'WH-PL'
WHERE r.status IN ('PENDING', 'APPROVED')
  AND r.type IN ('ISSUE_INTERNAL', 'WRITE_OFF')
GROUP BY ri."palletTypeId", ri.condition;
```
