-- 日记、留言、挑战：在 Supabase 的 SQL Editor 里整段运行一次

create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  room text not null,
  author text not null,
  kind text not null,            -- diary | note | challenge
  day text,                      -- 日记的日期 yyyy-mm-dd
  mood text,                     -- 日记的心情
  text text default '',
  photo text,                    -- 日记照片地址
  goal text,                     -- 挑战类型：hours | mountain
  target int,                    -- 挑战目标：小时数，或山的序号
  start_day text,
  end_day text,
  reactions jsonb default '{}'::jsonb,
  done_at bigint,
  created bigint not null
);
create index if not exists posts_room on posts (room, created desc);
alter table posts enable row level security;
create policy "open posts" on posts for all using (true) with check (true);
alter table posts replica identity full;
alter publication supabase_realtime add table posts;

-- 日记照片：公开读取的存储桶
insert into storage.buckets (id, name, public) values ('diary', 'diary', true) on conflict (id) do nothing;
create policy "diary photos read" on storage.objects for select using (bucket_id = 'diary');
create policy "diary photos upload" on storage.objects for insert with check (bucket_id = 'diary');
create policy "diary photos delete" on storage.objects for delete using (bucket_id = 'diary');
