-- ClassHub v0 schema. Run once in Supabase: SQL Editor > New query > paste > Run.
-- Covers: profiles, classes (invite code), memberships, chat, syntheses (+ file storage), ratings.
-- Every table has row-level security: you only see data from classes you belong to.

create extension if not exists pgcrypto;

-- ───────────── Tables ─────────────

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 40),
  created_at timestamptz not null default now()
);

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 60),
  school text check (char_length(school) <= 80),
  invite_code text not null unique,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.memberships (
  class_id uuid not null references public.classes(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'student' check (role in ('student', 'admin')),
  joined_at timestamptz not null default now(),
  primary key (class_id, user_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  channel text not null default 'general',
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index messages_class_created_idx on public.messages (class_id, created_at desc);

create table public.syntheses (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  subject text not null check (char_length(subject) between 1 and 60),
  chapter text check (char_length(chapter) <= 80),
  title text not null check (char_length(title) between 2 and 120),
  file_path text not null,
  created_at timestamptz not null default now()
);
create index syntheses_class_created_idx on public.syntheses (class_id, created_at desc);

create table public.ratings (
  synthesis_id uuid not null references public.syntheses(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  stars int not null check (stars between 1 and 5),
  comment text check (char_length(comment) <= 300),
  created_at timestamptz not null default now(),
  primary key (synthesis_id, user_id)
);

-- ───────────── Helper functions ─────────────

create or replace function public.is_member(cid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from memberships where class_id = cid and user_id = auth.uid());
$$;

create or replace function public.shares_class_with(uid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from memberships a
    join memberships b on a.class_id = b.class_id
    where a.user_id = auth.uid() and b.user_id = uid
  );
$$;

create or replace function public.synthesis_class(sid uuid)
returns uuid
language sql stable security definer set search_path = public
as $$
  select class_id from syntheses where id = sid;
$$;

create or replace function public.synthesis_author(sid uuid)
returns uuid
language sql stable security definer set search_path = public
as $$
  select user_id from syntheses where id = sid;
$$;

-- Create a class: generates a 6-character invite code, makes the caller its admin.
create or replace function public.create_class(p_name text, p_school text default null)
returns public.classes
language plpgsql security definer set search_path = public
as $$
declare
  new_class classes;
  code text;
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- no 0/O/1/I
  i int;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from classes where invite_code = code);
  end loop;
  insert into classes (name, school, invite_code)
  values (trim(p_name), nullif(trim(coalesce(p_school, '')), ''), code)
  returning * into new_class;
  insert into memberships (class_id, user_id, role) values (new_class.id, auth.uid(), 'admin');
  return new_class;
end;
$$;

-- Join a class with its invite code. Returns the class id.
create or replace function public.join_class(p_code text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  cid uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select id into cid from classes where invite_code = upper(trim(p_code));
  if cid is null then raise exception 'Code invalide'; end if;
  insert into memberships (class_id, user_id) values (cid, auth.uid())
  on conflict do nothing;
  return cid;
end;
$$;

grant execute on function public.create_class(text, text) to authenticated;
grant execute on function public.join_class(text) to authenticated;

-- Auto-create a profile when someone signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into profiles (id, display_name)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ───────────── Row-level security ─────────────

alter table public.profiles enable row level security;
alter table public.classes enable row level security;
alter table public.memberships enable row level security;
alter table public.messages enable row level security;
alter table public.syntheses enable row level security;
alter table public.ratings enable row level security;

create policy "profiles: see yourself and classmates" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.shares_class_with(id));
create policy "profiles: edit yourself" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "classes: members can read" on public.classes
  for select to authenticated using (public.is_member(id));

create policy "memberships: see your classmates" on public.memberships
  for select to authenticated using (public.is_member(class_id));
create policy "memberships: leave a class" on public.memberships
  for delete to authenticated using (user_id = auth.uid());

create policy "messages: members read" on public.messages
  for select to authenticated using (public.is_member(class_id));
create policy "messages: members write as themselves" on public.messages
  for insert to authenticated
  with check (user_id = auth.uid() and public.is_member(class_id));
create policy "messages: delete own or as class admin" on public.messages
  for delete to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from memberships m
               where m.class_id = messages.class_id and m.user_id = auth.uid() and m.role = 'admin')
  );

create policy "syntheses: members read" on public.syntheses
  for select to authenticated using (public.is_member(class_id));
create policy "syntheses: members publish as themselves" on public.syntheses
  for insert to authenticated
  with check (user_id = auth.uid() and public.is_member(class_id));
create policy "syntheses: delete own" on public.syntheses
  for delete to authenticated using (user_id = auth.uid());

create policy "ratings: members read" on public.ratings
  for select to authenticated using (public.is_member(public.synthesis_class(synthesis_id)));
create policy "ratings: rate others' syntheses" on public.ratings
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.is_member(public.synthesis_class(synthesis_id))
    and public.synthesis_author(synthesis_id) <> auth.uid()
  );
create policy "ratings: change your rating" on public.ratings
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ───────────── File storage (private bucket) ─────────────
-- Files live at  <class_id>/<random>-<filename>, so the first folder is the class.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('syntheses', 'syntheses', false, 10485760,
        array['application/pdf', 'image/png', 'image/jpeg'])
on conflict (id) do nothing;

create policy "storage: members read class files" on storage.objects
  for select to authenticated
  using (bucket_id = 'syntheses' and public.is_member(((storage.foldername(name))[1])::uuid));
create policy "storage: members upload to their class" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'syntheses' and public.is_member(((storage.foldername(name))[1])::uuid));
create policy "storage: delete own uploads" on storage.objects
  for delete to authenticated
  using (bucket_id = 'syntheses' and owner = auth.uid());

-- ───────────── Realtime for the chat ─────────────
alter publication supabase_realtime add table public.messages;
