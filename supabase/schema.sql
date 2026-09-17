-- ============================================================
-- 부산기계공업고등학교 홈페이지 - Supabase DB 스키마
--
-- 사용 방법:
--   1. https://supabase.com 에서 프로젝트 생성
--   2. 좌측 메뉴 [SQL Editor] → 이 파일 전체를 붙여넣고 [Run] 실행
--   3. [Project Settings] > [API] 에서 Project URL과 anon key를 복사해
--      js/supabase-config.js 파일에 입력
--
-- 참고: 회원가입 즉시 로그인을 원하면
--   [Authentication] > [Providers] > [Email] 에서
--   "Confirm email" 옵션을 끄세요.
-- ============================================================

-- 1) 회원 프로필 (auth.users와 1:1 연결)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '익명',
  grade int,
  class_no int,
  student_no int,
  role text not null default 'student' check (role in ('student', 'teacher', 'admin')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- 회원가입 시 users 메타데이터(name/grade/class_no/student_no)로 프로필 자동 생성
create or replace function public.handle_new_user ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, grade, class_no, student_no)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'name', ''),
      nullif(new.raw_user_meta_data ->> 'user_name', ''),
      nullif(new.raw_user_meta_data ->> 'preferred_username', ''),
      split_part(coalesce(new.email, ''), '@', 1),
      '익명'
    ),
    nullif(new.raw_user_meta_data ->> 'grade', '')::int,
    nullif(new.raw_user_meta_data ->> 'class_no', '')::int,
    nullif(new.raw_user_meta_data ->> 'student_no', '')::int
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user ();

-- 2) 동아리 목록
create table if not exists public.clubs (
  id bigint generated always as identity primary key,
  name text not null unique,
  category text not null default '',
  description text not null default '',
  max_members int not null default 20,
  is_open boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.clubs enable row level security;

drop policy if exists "clubs_public_select" on public.clubs;
create policy "clubs_public_select" on public.clubs
  for select using (true);

insert into public.clubs (name, category, description, max_members) values
  ('CNC 마스터', '기능육성', 'CNC 공작기계를 활용한 정밀 가공 기술을 연구하고 기능경기대회 입상을 목표로 합니다.', 20),
  ('로보틱스', '로봇연구', '산업용 로봇과 자동화 시스템을 학습하고 로봇 경진대회에 참가합니다.', 20),
  ('3D 프린팅', '메이커', '3D 모델링과 프린팅으로 아이디어를 직접 만들어보는 메이커 동아리입니다.', 20),
  ('자동차 정비', '자동차', '자동차 구조와 정비 기술을 실습하며 자동차정비사 자격 취득을 준비합니다.', 20),
  ('드론 동아리', '드론', '드론 조종과 비행 원리를 배우고 드론 관련 자격증 취득을 목표로 합니다.', 20)
on conflict (name) do nothing;

-- 3) 동아리 신청 내역
create table if not exists public.club_applications (
  id bigint generated always as identity primary key,
  club_id bigint not null references public.clubs (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  message text not null default '',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (club_id, user_id)
);

alter table public.club_applications enable row level security;

drop policy if exists "apps_select_own" on public.club_applications;
create policy "apps_select_own" on public.club_applications
  for select using (auth.uid() = user_id);

drop policy if exists "apps_insert_own" on public.club_applications;
create policy "apps_insert_own" on public.club_applications
  for insert with check (auth.uid() = user_id and status = 'pending');

drop policy if exists "apps_delete_own" on public.club_applications;
create policy "apps_delete_own" on public.club_applications
  for delete using (auth.uid() = user_id);

-- 관리자/교사 권한 정책 (profiles.role 기준)
drop policy if exists "apps_admin_select" on public.club_applications;
create policy "apps_admin_select" on public.club_applications
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'teacher')
    )
  );

drop policy if exists "apps_admin_update" on public.club_applications;
create policy "apps_admin_update" on public.club_applications
  for update using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'teacher')
    )
  );

-- 상태 변경 시 updated_at 자동 갱신
create or replace function public.touch_updated_at ()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_apps_updated on public.club_applications;
create trigger on_apps_updated
  before update on public.club_applications
  for each row execute function public.touch_updated_at ();

-- 4) 동아리별 신청 인원 집계 함수 (RLS 우회, 익명 집계만 공개)
create or replace function public.club_counts ()
returns table (club_id bigint, approved_count bigint, pending_count bigint)
language sql
security definer
set search_path = public
stable
as $$
  select ca.club_id,
         count(*) filter (where ca.status = 'approved') as approved_count,
         count(*) filter (where ca.status = 'pending') as pending_count
  from public.club_applications ca
  group by ca.club_id;
$$;

revoke all on function public.club_counts () from public;
grant execute on function public.club_counts () to anon, authenticated;
