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
