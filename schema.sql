-- 在 Supabase 的 SQL Editor 里整段运行一次

create table if not exists rooms (
  code text primary key,
  world text not null default 'mountain',
  cat_name text not null default '团子'
);

create table if not exists logs (
  id uuid primary key default gen_random_uuid(),
  room text not null,
  author text not null,
  minutes int not null,
  label text default '',
  "full" boolean default true,
  failed boolean default false,
  together boolean default false,
  pickups int default 0,
  hugs jsonb default '{}'::jsonb,
  at bigint not null
);
create index if not exists logs_room_at on logs (room, at desc);

create table if not exists focus (
  room text not null,
  author text not null,
  phase text,
  label text default '',
  updated bigint,
  primary key (room, author)
);

-- 只有你们俩用：知道房间码就能读写
alter table rooms enable row level security;
alter table logs enable row level security;
alter table focus enable row level security;
create policy "open rooms" on rooms for all using (true) with check (true);
create policy "open logs" on logs for all using (true) with check (true);
create policy "open focus" on focus for all using (true) with check (true);

-- 实时同步
alter table logs replica identity full;
alter table focus replica identity full;
alter publication supabase_realtime add table rooms, logs, focus;
-- 学习计划表：在 Supabase 的 SQL Editor 里整段运行一次
create table if not exists plans (
  id uuid primary key default gen_random_uuid(),
  room text not null,
  author text not null,
  title text not null,
  note text default '',
  day text,
  est int,
  spent int default 0,
  done boolean default false,
  done_at bigint,
  created bigint not null
);
create index if not exists plans_room on plans (room);
alter table plans enable row level security;
create policy "open plans" on plans for all using (true) with check (true);
alter table plans replica identity full;
alter publication supabase_realtime add table plans;
