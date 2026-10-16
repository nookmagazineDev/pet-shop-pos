-- ============================================================
-- NAS: สิทธิ์และระบบล็อกอินแบบ JWT (แทน Supabase Auth)
-- รันหลัง 0001_initial_schema.sql
-- ============================================================
-- หน้าเว็บเรียก POST /rpc/login_user → ได้ token กลับมา
-- แล้วส่ง header  Authorization: Bearer <token>  ทุก request
-- PostgREST ตรวจลายเซ็นด้วย JWT_SECRET แล้วสลับเป็น role "authenticated"
-- ============================================================

create or replace function _b64url(data bytea)
returns text
language sql
immutable
as $$
  select translate(rtrim(encode(data, 'base64'), '='), E'+/\n', '-_');
$$;

create or replace function sign_jwt(payload jsonb)
returns text
language plpgsql
set search_path = public, extensions
as $$
declare
  v_secret text := current_setting('app.jwt_secret', true);
  v_header text;
  v_body   text;
begin
  if v_secret is null or v_secret = '' then
    raise exception 'app.jwt_secret is not set';
  end if;
  v_header := _b64url(convert_to('{"alg":"HS256","typ":"JWT"}', 'utf8'));
  v_body   := _b64url(convert_to(payload::text, 'utf8'));
  return v_header || '.' || v_body || '.' ||
         _b64url(hmac(v_header || '.' || v_body, v_secret, 'sha256'));
end;
$$;

-- เหมือน login_user ใน 0001 แต่คืน token ด้วย (อายุ 12 ชั่วโมง ≈ 1 กะ)
create or replace function login_user(p_username text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  u record;
begin
  select * into u
    from "Users"
   where lower("Username") = lower(trim(p_username))
     and "Password" = crypt(p_password, "Password")
   limit 1;

  if not found then
    perform pg_sleep(1);
    return jsonb_build_object('success', false, 'error', 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
  end if;
  if upper(coalesce(u."IsActive", 'TRUE')) <> 'TRUE' then
    return jsonb_build_object('success', false, 'error', 'บัญชีนี้ถูกระงับการใช้งาน');
  end if;

  update "Users" set "LastLogin" = now() where id = u.id;

  return jsonb_build_object(
    'success', true,
    'token', sign_jwt(jsonb_build_object(
      'role', 'authenticated',
      'username', u."Username",
      'app_role', u."Role",
      'exp', extract(epoch from now() + interval '12 hours')::bigint
    )),
    'user', jsonb_build_object(
      'userId', u."UserID",
      'username', u."Username",
      'displayName', u."DisplayName",
      'role', u."Role",
      'isActive', true
    )
  );
end;
$$;

-- ------------------------------------------------------------
-- สิทธิ์ตาราง (RLS ใน 0001 กรองซ้ำอีกชั้น)
-- ------------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;

-- พนักงานอ่านตาราง Users ได้ทุกคอลัมน์ยกเว้นรหัสผ่าน
revoke select on "Users" from authenticated;
grant select ("id", "UserID", "Username", "DisplayName", "Role", "IsActive", "CreatedAt", "LastLogin")
  on "Users" to authenticated;

-- ------------------------------------------------------------
-- สิทธิ์ฟังก์ชัน: ปิดทั้งหมดก่อน แล้วเปิดเฉพาะที่ต้องใช้
-- sign_jwt ต้องไม่มีใครเรียกตรงได้ ไม่อย่างนั้นจะปลอม token ได้
-- ------------------------------------------------------------
revoke execute on all functions in schema public from public;
alter default privileges in schema public revoke execute on functions from public;

grant execute on function login_user(text, text) to anon, authenticated;
grant execute on function
  process_checkout(jsonb),
  next_doc_number(text),
  adjust_customer_credits(text, numeric, text, text, text, text, text),
  adjust_customer_points(text, numeric, text, text, text, text)
  to authenticated, service_role;
