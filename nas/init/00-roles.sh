#!/bin/sh
# Roles ที่ PostgREST สลับใช้ตาม JWT (ชื่อเดียวกับ Supabase เพื่อให้ RLS ใน 0001 ใช้ได้เลย)
#   anon          — ยังไม่ล็อกอิน: เรียกได้แค่ login_user
#   authenticated — พนักงานที่ล็อกอินแล้ว
#   service_role  — ข้าม RLS ใช้ตอนย้ายข้อมูลเท่านั้น
#   authenticator — บัญชีที่ PostgREST ใช้เชื่อมต่อ แล้วสลับเป็น role ข้างบน
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -v auth_pw="$AUTHENTICATOR_PASSWORD" -v jwt_secret="$JWT_SECRET" <<'EOSQL'
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create role authenticator noinherit login password :'auth_pw';
grant anon, authenticated, service_role to authenticator;

select set_config('app.init_jwt_secret', :'jwt_secret', false) as _ \gset
do $$
begin
  execute format('alter database %I set app.jwt_secret = %L',
                 current_database(), current_setting('app.init_jwt_secret'));
end;
$$;
EOSQL
