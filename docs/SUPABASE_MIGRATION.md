# แผนย้ายฐานข้อมูลจาก Google Sheets → Supabase

เอกสารนี้สรุป (1) ปัญหาของระบบปัจจุบันที่ตรวจพบ (2) ทางเลือกในการย้ายไป Supabase แต่ละวิธี พร้อมข้อดี-ข้อเสีย (3) ขั้นตอนที่แนะนำ และ (4) สิ่งที่เตรียมไว้ให้แล้วใน branch นี้

---

## 1. ผลตรวจระบบปัจจุบัน — จุดที่ควรแก้

สถาปัตยกรรมตอนนี้: React (Vercel) → Google Apps Script (`backend/Code.gs`) → Google Sheets 23 ชีต

### 🔴 ร้ายแรง (Supabase แก้ให้ได้โดยตรง)

1. **API ไม่มีการยืนยันตัวตนเลย** — URL ของ Apps Script อยู่ใน `src/api.js` (ฝังอยู่ใน bundle ที่ deploy บน Vercel ใครก็เปิดดูได้) และ endpoint เปิดรับทุก request: ใครที่รู้ URL สามารถดึงข้อมูลลูกค้าทั้งหมด (ชื่อ เบอร์โทร เลขภาษี ที่อยู่) ยอดขายทั้งหมด หรือแม้แต่สั่ง `deleteUser` / `checkout` ปลอมได้ทันที การเช็คสิทธิ์ (role) ทำที่ฝั่ง browser เท่านั้น
2. **รหัสผ่านเก็บเป็น plaintext** ในชีต Users และมี default `admin/admin1234` ที่สร้างอัตโนมัติ
3. **ไม่มี transaction / ไม่มี lock** — `processCheckout` อ่านทั้งชีตแล้วเขียนกลับทีละเซลล์ ถ้ามี 2 เครื่องขายพร้อมกันจะเกิด: เลขที่ใบเสร็จ/ใบกำกับภาษีซ้ำกัน (เพราะนับเลขด้วยการ scan ชีตหาเลขล่าสุด), สต็อกหักผิด (read-modify-write ชนกัน), และถ้าล้มกลางทางข้อมูลจะค้างครึ่ง ๆ กลาง ๆ (บันทึกบิลแล้วแต่ยังไม่หักสต็อก)

### 🟡 ปานกลาง

4. **อ้างอิงลูกค้าด้วย "ชื่อ" ไม่ใช่ ID** — แต้ม เครดิต แพ็กเกจ คูปอง ผูกกับ `CustomerName` ทั้งหมด ถ้าแก้ชื่อลูกค้า ประวัติและยอดคงเหลือจะหลุดจากกันหมด (ใน Postgres ควรเปลี่ยนเป็น FK ไป `CustomerID` ในเฟสถัดไป)
5. **ช้าลงเรื่อย ๆ ตามข้อมูล** — ทุก request อ่านทั้งชีต (`getDataRange().getValues()`) และการหักสต็อกวนอ่านชีตใหม่ทุกชิ้นในตะกร้า พอ Transactions โตหลักหมื่นแถวจะช้ามาก และ Google Sheets มีเพดาน ~10 ล้านเซลล์
6. **`fetchApi` กลืน error เงียบ ๆ** (`return []`) — ถ้า API ล่ม หน้าจอจะแสดง "ไม่มีข้อมูล" แทนที่จะบอกว่าโหลดไม่สำเร็จ ทำให้วินิจฉัยปัญหายาก

### 🟢 เล็กน้อย

7. `setup()` ใน Code.gs ไม่ได้สร้างชีต `Expenses` และ `InventoryReceipts` (ไปสร้างแบบ lazy ตอนใช้งานแทน และ header ของ Expenses สองจุดไม่ตรงกัน — จุดหนึ่งมี `ItemsJSON` อีกจุดไม่มี)
8. ตะกร้าสินค้า (`CartDetails`) และข้อมูลลูกค้าเก็บเป็น JSON string ในเซลล์เดียว — ทำรายงานเชิงลึก (เช่น สินค้าขายดี) ต้อง parse เองทุกครั้ง ใน Postgres ใช้ `jsonb` query ได้เลย

---

## 2. ทางเลือกในการย้ายไป Supabase

### วิธี A — เปลี่ยน frontend ไปเรียก Supabase ตรง ๆ (`supabase-js`) ✅ แนะนำ

frontend เรียก Supabase โดยตรงผ่าน PostgREST + RPC โดย**คงชื่อคอลัมน์เดิมทุกตัว** (schema ใน branch นี้ตั้งชื่อคอลัมน์ตรงกับ header ของชีตเป๊ะ ๆ เช่น `Barcode`, `CostPrice`) ทำให้แก้แค่ชั้น `src/api.js` — ฟังก์ชัน `fetchApi(action)` / `postApi(data)` คง signature เดิม แต่ข้างในสลับไปเรียก Supabase แทน หน้าจอทั้ง 16 หน้าแทบไม่ต้องแก้

- อ่านข้อมูล: `fetchApi("getProducts")` → `supabase.from("Products").select("*")`
- เขียนที่ซับซ้อน (checkout, คืนสินค้า): เรียก RPC ฝั่ง database (เตรียม `process_checkout` ไว้ให้แล้ว) ได้ atomic transaction จริง
- Login: RPC `login_user` (bcrypt) หรือย้ายไป Supabase Auth เต็มตัวในเฟสถัดไป

| ข้อดี | ข้อเสีย |
|---|---|
| เร็วขึ้นมาก (query เฉพาะที่ใช้ + index) | ต้องเขียน logic ฝั่ง write ใหม่ (~40 action) |
| ได้ transaction + เลขบิลไม่ซ้ำ | ต้องทยอยทำทีละโมดูล |
| ได้ RLS + ระบบสิทธิ์จริง | |
| ไม่ต้องดูแล server เพิ่ม (ฟรีเทียร์พอสำหรับร้านเดียว) | |

### วิธี B — Edge Function เลียนแบบ API เดิม (เปลี่ยนแค่ URL)

เขียน Supabase Edge Function รับ `?action=getProducts` (GET) และ `{action, payload}` (POST) เหมือน Apps Script ทุกประการ แล้วเปลี่ยนค่า `API_URL` ใน `src/api.js` บรรทัดเดียว

| ข้อดี | ข้อเสีย |
|---|---|
| frontend ไม่ต้องแก้เลย | ต้อง port ทั้ง 3,000 บรรทัดของ Code.gs ไป Deno ในครั้งเดียว |
| สลับกลับได้ทันทีถ้ามีปัญหา | ยังไม่ได้ประโยชน์จาก query แบบเลือกเฉพาะส่วน |
| | เสี่ยง bug จากการ port ก้อนใหญ่ |

เหมาะถ้าต้องการ "ย้ายบ้านโดยไม่แตะ frontend" แต่โดยรวมงานหนักกว่าวิธี A และได้ประโยชน์น้อยกว่า

### วิธี C — ย้ายแบบขนาน (Dual-write) แล้วค่อยตัดสลับ

ช่วงเปลี่ยนผ่านให้เขียนลงทั้ง Sheets และ Supabase พร้อมกัน อ่านจาก Supabase เทียบผลกับชีตจนมั่นใจ แล้วค่อยปิดฝั่งชีต — ปลอดภัยสุดแต่ซับซ้อนสุด เหมาะกับระบบที่หยุดไม่ได้เลย ร้านเดียวปิดร้านย้ายข้ามคืนได้ ไม่จำเป็นต้องทำถึงขนาดนี้

### สรุปคำแนะนำ

> **ใช้วิธี A แบบทยอยทำ**: ย้ายข้อมูลทั้งหมดเข้า Supabase ก่อน (สคริปต์เตรียมให้แล้ว) → สลับ "ฝั่งอ่าน" ทุกหน้าไปอ่าน Supabase (งานน้อย เพราะชื่อคอลัมน์ตรงกัน) → ทยอยย้าย "ฝั่งเขียน" ทีละโมดูล เริ่มจาก checkout (RPC เตรียมให้แล้ว) → ปิด Apps Script

---

## 3. ขั้นตอนลงมือทำ

### เฟส 0 — เตรียมโปรเจกต์ (ครึ่งวัน)
1. สมัคร [supabase.com](https://supabase.com) สร้างโปรเจกต์ (เลือก region Singapore ใกล้ไทยสุด)
2. ไปที่ **SQL Editor** → วางเนื้อหา `supabase/migrations/0001_initial_schema.sql` → Run
   จะได้ตารางครบ 23 ตาราง + ระบบเลขที่เอกสาร + RPC checkout/login + RLS
3. จด `Project URL`, `anon key`, `service_role key` จาก Settings → API

### เฟส 1 — ย้ายข้อมูล (1 ชั่วโมง)
```bash
export SUPABASE_URL="https://xxxx.supabase.co"
export SUPABASE_SERVICE_KEY="eyJ..."   # service_role key — ห้าม commit / ห้ามใส่ใน frontend
node scripts/migrate-sheets-to-supabase.mjs
```
- สคริปต์ดึงข้อมูลจาก API เดิมทุก action แล้ว insert เข้า Supabase (ข้ามตารางที่มีข้อมูลอยู่แล้ว จึงรันซ้ำได้)
- ตรวจนับ: จำนวนแถวแต่ละตาราง, ยอดขายรวม, สต็อกรวม เทียบกับชีตเดิม
- ตั้งรหัสผ่านผู้ใช้ใหม่ (API เดิมไม่ส่งรหัสผ่านออกมา):
  ```sql
  update "Users" set "Password" = crypt('รหัสผ่านใหม่', gen_salt('bf')) where "Username" = 'admin';
  ```

### เฟส 2 — สลับฝั่งอ่าน (1–2 วัน)
1. `npm install @supabase/supabase-js`
2. สร้าง `src/lib/supabase.js` (ใช้ **anon key** เท่านั้น) และตั้ง env ใน Vercel: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
3. แก้ `fetchApi` ใน `src/api.js` ให้ map action → `supabase.from(table).select()` (ตาราง action↔table อยู่ใน `scripts/migrate-sheets-to-supabase.mjs` แล้ว)
4. เพิ่ม `.order()` และ `.limit()` ให้ตารางใหญ่ (Transactions, StockMovements) — ได้ความเร็วเพิ่มทันที

### เฟส 3 — สลับฝั่งเขียน (ทยอยทำ 1–2 สัปดาห์)
ลำดับที่แนะนำ (จากผลกระทบสูง → ต่ำ):
1. `checkout` → `supabase.rpc("process_checkout", { payload })` (พร้อมใช้แล้ว)
2. `login` → `supabase.rpc("login_user", {...})` — เลิกใช้รหัส plaintext
3. รับสินค้าเข้า / ย้ายสต็อก / ยกเลิกบิล / คืนสินค้า (เขียนเป็น RPC เพิ่มตามแบบ `process_checkout`)
4. งาน CRUD ธรรมดา (ลูกค้า สินค้า คูปอง ฯลฯ) ใช้ `.insert()/.update()` ตรง ๆ ได้เลย
5. เสร็จแล้วปิด Apps Script deployment เพื่อปิดช่องโหว่ API สาธารณะ

### เฟส 4 — ยกระดับ (ทำทีหลังได้)
- ย้ายผู้ใช้ไป **Supabase Auth** เต็มตัว แล้วเขียน RLS แยกตาม role (เช่น staff ห้ามลบผู้ใช้ / ห้ามดูต้นทุน)
- เปลี่ยน FK จาก `CustomerName` → `CustomerID`
- ใช้ **Realtime** ให้สต็อกอัปเดตสดข้ามเครื่อง POS หลายจุด
- ตั้ง scheduled backup (Supabase มี daily backup ให้ใน Pro plan; ฟรีเทียร์ export เองได้)

---

## 4. สิ่งที่เตรียมไว้ให้แล้วใน branch นี้

| ไฟล์ | หน้าที่ |
|---|---|
| `supabase/migrations/0001_initial_schema.sql` | สร้างตารางครบ 23 ตาราง (ชื่อคอลัมน์ตรงกับชีตเดิมเป๊ะ เพื่อให้ frontend แก้น้อยสุด) + เลขที่เอกสารกันซ้ำ (`next_doc_number`) + RPC `process_checkout` (atomic), `login_user`/`hash_existing_passwords` (bcrypt), `adjust_customer_points/credits` + เปิด RLS ทุกตาราง |
| `scripts/migrate-sheets-to-supabase.mjs` | ย้ายข้อมูลจริงจากชีต → Supabase ผ่าน API เดิม (ไม่ต้อง export CSV เอง) พร้อมแปลงชนิดข้อมูล (ตัวเลข/วันที่/jsonb) |
| `docs/SUPABASE_MIGRATION.md` | เอกสารฉบับนี้ |

**ข้อควรระวังเรื่อง key:**
- `anon key` → ใช้ใน frontend ได้ (ถูกจำกัดด้วย RLS)
- `service_role key` → ข้าม RLS ทั้งหมด ใช้เฉพาะในสคริปต์ migration บนเครื่องตัวเอง ห้าม commit ลง git และห้ามใส่ใน frontend เด็ดขาด
