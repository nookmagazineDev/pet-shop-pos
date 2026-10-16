# แผนย้ายฐานข้อมูลจาก Google Sheets → Supabase

> **อยากเก็บฐานข้อมูลไว้บน NAS ในร้านแทน Supabase cloud?** ดู [`docs/NAS_SETUP.md`](NAS_SETUP.md) — ใช้ตารางและสคริปต์ย้ายข้อมูลชุดเดียวกัน

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

### เฟส 0 — สร้างโปรเจกต์ Supabase (ประมาณ 20 นาที)

**ขั้นที่ 1 — สมัครและสร้างโปรเจกต์**
1. เข้า [supabase.com](https://supabase.com) → **Start your project** → สมัครด้วยบัญชี GitHub หรืออีเมล
2. กด **New project** แล้วกรอก:
   - **Name:** `pet-shop-pos` (ตั้งชื่ออะไรก็ได้)
   - **Database Password:** กด Generate แล้ว**จดเก็บไว้ที่ปลอดภัย**
   - **Region:** `Southeast Asia (Singapore)` — ใกล้ไทยที่สุด เร็วที่สุด
   - **Plan:** Free พอสำหรับร้านเดียว
3. กด **Create new project** แล้วรอประมาณ 2 นาทีจนสถานะขึ้นพร้อมใช้งาน

**ขั้นที่ 2 — สร้างตาราง**
1. เมนูซ้าย → **SQL Editor** → **New query**
2. เปิดไฟล์ `supabase/migrations/0001_initial_schema.sql` คัดลอก**ทั้งไฟล์**ไปวาง → กด **Run**
3. ต้องขึ้น `Success. No rows returned` ถ้าขึ้น error ให้คัดลอกข้อความ error มาถาม
4. ตรวจผล: เมนูซ้าย → **Table Editor** ต้องเห็นตาราง `Products`, `Transactions`, `Customers` ฯลฯ ครบ 23 ตาราง (ยังว่างอยู่ ถูกต้องแล้ว)

**ขั้นที่ 3 — คัดลอก URL และ key**
เมนูซ้าย → **Project Settings** (รูปเฟือง) แล้วจดค่าต่อไปนี้:
- **Project URL** (หน้า Data API หรือ General) เช่น `https://abcdefgh.supabase.co`
- **Publishable key** (หน้า API Keys) ขึ้นต้นด้วย `sb_publishable_...` — ใช้ใน frontend ตอนเฟส 2
- **Secret key** (หน้า API Keys → กดแสดง) ขึ้นต้นด้วย `sb_secret_...` — ใช้ย้ายข้อมูลเท่านั้น

> ถ้าโปรเจกต์ยังมีแท็บ *Legacy API keys* อยู่ ใช้ `service_role` (ขึ้นต้น `eyJ...`) แทน secret key ก็ได้ สคริปต์รองรับทั้งสองแบบ แต่ Supabase กำลังเลิกใช้ key แบบเก่า ควรใช้แบบใหม่

### เฟส 1 — ย้ายข้อมูลจาก Google Sheets (ประมาณ 30 นาที)

ต้องรัน**บนเครื่องคอมของร้าน** (เครื่องที่เปิดเว็บ POS ได้ปกติ) เพราะสคริปต์ดึงข้อมูลผ่าน API ของ Google Sheets ตัวเดิม

**ขั้นที่ 4 — เตรียมเครื่อง**
1. ต้องมี Node.js 18 ขึ้นไป — เปิด PowerShell พิมพ์ `node -v` ถ้าไม่ขึ้นเลขเวอร์ชัน ให้ติดตั้งด้วย `setup/install-nodejs.bat`
2. ดาวน์โหลดโค้ด branch นี้ลงเครื่อง (`git pull` หรือ Download ZIP จาก GitHub)
3. เปิด PowerShell ที่โฟลเดอร์โปรเจกต์ (คลิกขวาในโฟลเดอร์ → *Open in Terminal*)

**ขั้นที่ 5 — รันสคริปต์**
```powershell
$env:SUPABASE_URL = "https://abcdefgh.supabase.co"
$env:SUPABASE_SERVICE_KEY = "sb_secret_..."
node scripts/migrate-sheets-to-supabase.mjs
```
(macOS/Linux ใช้ `export SUPABASE_URL="..."` แทน `$env:...`)

จะเห็นผลทีละตาราง เช่น
```
▸ Products           ✅ 342 แถว
▸ StoreStock         ✅ 120 แถว
▸ Transactions       ✅ 5180 แถว
```
- `✅` = ย้ายสำเร็จ · `ไม่มีข้อมูลในชีต` = ชีตนั้นว่าง ปกติ · `❌` = มีปัญหา ให้คัดลอกข้อความมาถาม
- **รันซ้ำได้ปลอดภัย** — ตารางที่มีข้อมูลแล้วจะถูกข้าม ไม่ซ้ำ ถ้าบางตารางขึ้น ❌ แก้แล้วรันใหม่ได้เลย
- ต้องการล้างแล้วย้ายใหม่ทั้งหมด: SQL Editor → `truncate "Products", "Transactions";` (ใส่ชื่อตารางที่ต้องการ) แล้วรันสคริปต์ใหม่

**ขั้นที่ 6 — ตั้งรหัสผ่านพนักงานใหม่**
API เดิมไม่ส่งรหัสผ่านออกมา (ถูกต้องแล้วตามหลักความปลอดภัย) จึงต้องตั้งใหม่ใน SQL Editor ทีละคน — รหัสจะถูกเข้ารหัสแบบ bcrypt ไม่เก็บเป็นตัวอักษรตรง ๆ อีกต่อไป:
```sql
update "Users" set "Password" = crypt('รหัสผ่านใหม่', gen_salt('bf')) where "Username" = 'admin';
```

**ขั้นที่ 7 — ตรวจความถูกต้อง** (SQL Editor) แล้วเทียบกับชีตเดิม:
```sql
select 'Products' t, count(*) from "Products" union all
select 'Transactions', count(*) from "Transactions" union all
select 'Customers', count(*) from "Customers";

select sum("TotalAmount") as ยอดขายรวม from "Transactions" where "Status" <> 'CANCELLED';
select sum("Quantity") as สต็อกรวม from "Products";
```
ตัวเลขตรงกับชีต = **เฟส 1 เสร็จสมบูรณ์** ✅

> ระหว่างเฟส 0–1 หน้าร้านยังใช้ Google Sheets ได้ตามปกติ ไม่กระทบการขาย แต่ถ้ามีการขายเพิ่มหลังย้ายข้อมูล ข้อมูลใหม่จะยังไม่อยู่ใน Supabase — ก่อนสลับระบบจริง (เฟส 2) ให้ truncate แล้วรันสคริปต์อีกรอบหลังปิดร้าน

### เฟส 2 — สลับฝั่งอ่าน (1–2 วัน)
1. `npm install @supabase/supabase-js`
2. สร้าง `src/lib/supabase.js` (ใช้ **publishable key** เท่านั้น) และตั้ง env ใน Vercel: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`
   - RLS ใน schema อนุญาตเฉพาะผู้ใช้ที่ล็อกอินแล้ว (`authenticated`) จึงต้องให้หน้า Login เข้าสู่ระบบผ่าน **Supabase Auth** (`supabase.auth.signInWithPassword`) ในเฟสนี้ด้วย — สร้างบัญชีพนักงานที่ Authentication → Users ไม่อย่างนั้น query จะได้ข้อมูลว่าง
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
- เขียน RLS แยกตาม role (ต่อจาก Supabase Auth ที่เริ่มใช้ในเฟส 2) (เช่น staff ห้ามลบผู้ใช้ / ห้ามดูต้นทุน)
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
- **Publishable key** (`sb_publishable_...`) → ใช้ใน frontend ได้ (ถูกจำกัดด้วย RLS)
- **Secret key** (`sb_secret_...`) → ข้าม RLS ทั้งหมด ใช้เฉพาะในสคริปต์ migration บนเครื่องตัวเอง ห้าม commit ลง git และห้ามใส่ใน frontend เด็ดขาด
