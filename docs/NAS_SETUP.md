# ติดตั้งฐานข้อมูล POS บน NAS (เปิดใช้จากนอกร้านได้)

ใช้แทน Supabase cloud — ข้อมูลทั้งหมดอยู่บน NAS ในร้าน และเปิดให้หน้าเว็บ (Vercel) หรือมือถือนอกร้านเข้าถึงผ่าน Cloudflare Tunnel แบบ HTTPS โดยไม่ต้องเปิดพอร์ตเราเตอร์

```
มือถือ / คอม / หน้าเว็บบน Vercel
        │  https://api.ร้านคุณ.com
        ▼
   Cloudflare (ฟรี)
        │  อุโมงค์เข้ารหัส (NAS เป็นฝ่ายต่อออกไปเอง)
        ▼
 ┌──────────── NAS ────────────┐
 │ tunnel → api (PostgREST) → db (PostgreSQL)
 │                         backup → ./backups (ทุกวัน)
 └─────────────────────────────┘
```

ไฟล์ที่เกี่ยวข้องทั้งหมดอยู่ในโฟลเดอร์ `nas/` และใช้ตารางชุดเดียวกับ `supabase/migrations/0001_initial_schema.sql`

---

## สิ่งที่ต้องมี

| | รายละเอียด |
|---|---|
| NAS ที่รัน Docker ได้ | Synology: แอป **Container Manager** · QNAP: แอป **Container Station** · RAM ว่างประมาณ 1 GB |
| โดเมน 1 ชื่อ | เช่น `ร้านคุณ.com` ประมาณ 300–500 บาท/ปี ต้องย้าย DNS มาไว้ที่ Cloudflare (ฟรี) — Cloudflare Tunnel แบบถาวรต้องใช้โดเมน |
| บัญชี Cloudflare | ฟรี |
| UPS (แนะนำมาก) | กันไฟดับกลางการขายแล้วฐานข้อมูลเสียหาย |

---

## ขั้นที่ 1 — คัดลอกไฟล์ไปไว้บน NAS

สร้างโฟลเดอร์บน NAS เช่น `/docker/pet-shop-pos` แล้วคัดลอกโฟลเดอร์ `nas/` **และ** `supabase/` จากโปรเจกต์ไปวาง โดยให้โครงสร้างเป็นแบบนี้ (สำคัญ เพราะ compose อ้างถึง `../supabase/...`):

```
/docker/pet-shop-pos/
├── nas/
│   ├── docker-compose.yml
│   ├── .env.example
│   └── init/
└── supabase/
    └── migrations/0001_initial_schema.sql
```

## ขั้นที่ 2 — ตั้งรหัสลับ (.env)

1. คัดลอก `nas/.env.example` เป็น `nas/.env`
2. สร้างค่าสุ่ม 3 ค่า (คนละค่ากัน) ใน PowerShell บนคอมเครื่องไหนก็ได้ — รันคำสั่งนี้ 3 ครั้ง:
   ```powershell
   -join (1..48 | ForEach-Object { '{0:x}' -f (Get-Random -Max 16) })
   ```
3. ใส่ลงใน `.env` ที่ `POSTGRES_PASSWORD`, `AUTHENTICATOR_PASSWORD`, `JWT_SECRET`
4. **เก็บไฟล์ `.env` สำรองไว้ที่ปลอดภัย** (เช่น password manager) — ถ้าหาย ต้องใช้ตอนกู้ข้อมูลและตอนย้ายข้อมูล

> ห้ามแชร์ `JWT_SECRET` ให้ใคร — ใครมีค่านี้สามารถสร้างสิทธิ์เข้าฐานข้อมูลได้ทั้งหมด

## ขั้นที่ 3 — ตั้ง Cloudflare Tunnel

1. เพิ่มโดเมนเข้า [dash.cloudflare.com](https://dash.cloudflare.com) แล้วเปลี่ยน nameserver ที่ผู้ให้บริการโดเมนตามที่ Cloudflare บอก (รอไม่กี่นาทีถึงไม่กี่ชั่วโมง)
2. เข้า **Zero Trust** → **Networks** → **Tunnels** → **Create a tunnel** → เลือก **Cloudflared** → ตั้งชื่อ เช่น `petshop-nas`
3. หน้าเลือกวิธีติดตั้ง เลือก **Docker** จะเห็นคำสั่งที่มี `--token eyJ...` — คัดลอก**เฉพาะข้อความยาวหลัง `--token`** ไปใส่ที่ `CLOUDFLARE_TUNNEL_TOKEN` ใน `.env`
4. หน้า **Public Hostname** ตั้งค่า:
   - Subdomain: `api` · Domain: โดเมนของคุณ
   - Service Type: `HTTP` · URL: `api:3000`
5. กด Save

> หน้าจอ Cloudflare เปลี่ยนชื่อเมนูบ่อย ถ้าหาไม่เจอให้มองหาคำว่า *Tunnels* ในเมนู Zero Trust

## ขั้นที่ 4 — เปิดระบบบน NAS

**Synology (Container Manager):**
1. เปิด **Container Manager** → **Project** → **Create**
2. Project name: `petshop` · Path: เลือกโฟลเดอร์ `/docker/pet-shop-pos/nas` · Source: **Use existing docker-compose.yml**
3. กด Next จนจบแล้ว **Done** — ระบบจะดาวน์โหลดและเปิด 4 container: `db`, `api`, `tunnel`, `backup`

**QNAP หรือใช้ SSH:**
```sh
cd /share/Container/pet-shop-pos/nas   # เปลี่ยนเป็น path ของคุณ
docker compose up -d
```

ครั้งแรกฐานข้อมูลจะสร้างตารางทั้ง 23 ตาราง + ระบบล็อกอินให้อัตโนมัติ (สคริปต์ใน `nas/init/` รัน**ครั้งเดียว**ตอนโฟลเดอร์ `nas/data` ยังว่าง)

## ขั้นที่ 5 — ตรวจว่าทำงาน

เปิดเบราว์เซอร์ไปที่ `http://<IP ของ NAS>:3000/Products` และ `https://api.<โดเมนคุณ>/Products`

ทั้งสองต้องขึ้นข้อความประมาณ `"permission denied for table Products"` — **แปลว่าถูกต้อง**: ระบบทำงานและปฏิเสธคนที่ยังไม่ล็อกอิน

ถ้าขึ้นเว็บไม่ได้เลย: ดู log ของ container `api` และ `tunnel` ใน Container Manager

## ขั้นที่ 6 — สร้างบัญชีผู้ดูแล

Container Manager → **Container** → `petshop-db-1` → **Action** → **Open terminal** → **Create** → พิมพ์ `psql -U postgres` แล้วรัน:

```sql
insert into "Users" ("UserID", "Username", "Password", "DisplayName", "Role")
values ('USR-001', 'admin', crypt('ตั้งรหัสผ่านใหม่ที่นี่', gen_salt('bf')), 'ผู้ดูแลระบบ', 'admin');
```
(ถ้าย้ายข้อมูลในขั้นที่ 7 แล้วมีผู้ใช้เดิมอยู่ ให้ใช้ `update "Users" set "Password" = crypt('...', gen_salt('bf')) where "Username" = 'ชื่อผู้ใช้';` แทน — ผู้ใช้ที่ย้ายมาจะยังไม่มีรหัสผ่าน)

## ขั้นที่ 7 — ย้ายข้อมูลจาก Google Sheets

รันบนคอมในร้าน (วงแลนเดียวกับ NAS) — ต้องมี Node.js 18+ (`setup/install-nodejs.bat`) เปิด PowerShell ที่โฟลเดอร์โปรเจกต์:

```powershell
$env:REST_URL = "http://<IP ของ NAS>:3000"
$env:JWT_SECRET = "<ค่า JWT_SECRET จากไฟล์ .env>"
node scripts/migrate-sheets-to-supabase.mjs
```

- ✅ = ย้ายสำเร็จ · `ไม่มีข้อมูลในชีต` = ปกติ · ❌ = คัดลอกข้อความมาถาม
- รันซ้ำได้ ตารางที่มีข้อมูลแล้วจะถูกข้าม
- ปิดหน้าต่าง PowerShell หลังเสร็จ เพื่อไม่ให้ `JWT_SECRET` ค้างอยู่

## ขั้นที่ 8 — เทียบยอดกับชีตเดิม

ใน terminal ของ `db` (`psql -U postgres`):
```sql
select 'Products' t, count(*) from "Products" union all
select 'Transactions', count(*) from "Transactions" union all
select 'Customers', count(*) from "Customers";

select sum("TotalAmount") as ยอดขายรวม from "Transactions" where "Status" <> 'CANCELLED';
select sum("Quantity") as สต็อกรวม from "Products";
```
ตัวเลขตรงกับชีต = ย้ายข้อมูลเสร็จ ✅

---

## การสำรองข้อมูล (สำคัญมาก)

- container `backup` สำรองทุก 24 ชั่วโมง (และทันทีที่เปิดระบบ) ลง `nas/backups/petshop-YYYYMMDD-HHMM.dump` เก็บย้อนหลัง 30 วัน
- **ไฟล์สำรองอยู่บน NAS เครื่องเดียวกัน — ถ้า NAS เสีย/ถูกขโมย/ไฟไหม้ จะหายพร้อมกัน** ต้องคัดลอกออกนอก NAS ด้วย:
  - Synology: **Hyper Backup** → สำรองโฟลเดอร์ `nas/backups` ไป Google Drive / Synology C2 / USB ทุกวัน
  - QNAP: **Hybrid Backup Sync** ทำแบบเดียวกัน
- เก็บไฟล์ `.env` สำรองไว้นอก NAS ด้วย

**กู้ข้อมูลจากไฟล์สำรอง** (terminal ของ `backup`):
```sh
pg_restore --clean --if-exists -d postgres /backups/petshop-20261016-0300.dump
```

## ความปลอดภัย — สิ่งที่เปิดออกอินเทอร์เน็ต

| ใคร | ทำอะไรได้ |
|---|---|
| คนทั่วไปบนอินเทอร์เน็ต | เรียก `login_user` ได้อย่างเดียว (ใส่รหัสผิดจะหน่วง 1 วินาที กันการเดารหัส) |
| พนักงานที่ล็อกอินแล้ว | อ่าน/เขียนข้อมูลร้านได้ (token หมดอายุใน 12 ชั่วโมง) — มองไม่เห็นรหัสผ่านในตาราง Users |
| คนมี `JWT_SECRET` | ทำได้ทุกอย่าง — ใช้เฉพาะตอนย้ายข้อมูล |

- PostgreSQL (พอร์ต 5432) **ไม่ได้เปิด**ออกนอก NAS
- แนะนำเพิ่ม: Cloudflare → Security → WAF → **Rate limiting rules** จำกัด `/rpc/login_user` เช่น 10 ครั้ง/นาที/IP (แผนฟรีทำได้ 1 กฎ)
- ตั้งรหัสผ่านพนักงานให้เดายาก และระงับบัญชีพนักงานที่ลาออกทันที

---

## เฟสถัดไป — ให้หน้าเว็บใช้ฐานข้อมูลบน NAS

ฐานข้อมูลบน NAS พร้อมใช้แล้ว แต่หน้าเว็บยังเรียก Google Sheets อยู่ ขั้นต่อไปคือแก้ `src/api.js`:

1. ตั้ง `VITE_API_URL=https://api.<โดเมนคุณ>` ใน Vercel
2. หน้า Login เรียก `POST /rpc/login_user` (body `{"p_username": "...", "p_password": "..."}`) → เก็บ `token` ไว้ใน `sessionStorage`
3. ทุก request ใส่ header `Authorization: Bearer <token>` — ถ้าได้ 401 ให้เด้งกลับหน้า Login
4. อ่านข้อมูล: `GET /Products`, `GET /Transactions?order=Date.desc&limit=500` ฯลฯ — ตาราง `Users` ต้องระบุคอลัมน์ (`/Users?select=UserID,Username,DisplayName,Role,IsActive`)
5. ขายสินค้า: `POST /rpc/process_checkout` (body `{"payload": {...}}`) — ตัดสต็อก/ออกเลขบิล/แต้มในธุรกรรมเดียว

> ต่างจากแผน Supabase ตรงที่ไม่ใช้ Supabase Auth — ใช้ token จาก `login_user` แทน ส่วนตาราง ฟังก์ชัน และชื่อคอลัมน์เหมือนเดิมทุกอย่าง

## แก้ปัญหาที่พบบ่อย

- **สร้างตารางไม่ครบ / login ไม่ได้ตั้งแต่แรก**: สคริปต์ `init/` รันเฉพาะตอน `nas/data` ว่าง ถ้าเคยเปิดระบบแล้วล้มกลางทาง ให้หยุด project → **ลบโฟลเดอร์ `nas/data`** (ทำได้เฉพาะตอนยังไม่มีข้อมูลจริง!) → เปิดใหม่
- **เปลี่ยน `JWT_SECRET` ภายหลัง**: ต้องแก้ทั้งใน `.env` และในฐานข้อมูล (`alter database postgres set app.jwt_secret = 'ค่าใหม่';`) แล้วรีสตาร์ท `api` — พนักงานทุกคนต้องล็อกอินใหม่
- **tunnel ขึ้น error**: ตรวจว่า `CLOUDFLARE_TUNNEL_TOKEN` ไม่มีช่องว่าง และ Public Hostname ชี้ไปที่ `api:3000` (ไม่ใช่ `localhost:3000`)
