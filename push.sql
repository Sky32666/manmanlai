-- 推送通知：记录每台手机的推送地址。在 Supabase 的 SQL Editor 里整段运行一次
create table if not exists push_subs (
  endpoint text primary key,     -- 这台手机的推送地址
  room text not null,
  author text not null,
  sub jsonb not null,            -- 浏览器给的完整订阅信息
  tz text,                       -- 手机时区，用来判断"几点了"
  hourly boolean default true,   -- 要不要每小时提醒拍一刻
  created bigint
);
create index if not exists push_subs_room on push_subs (room);
alter table push_subs enable row level security;
create policy "open push_subs" on push_subs for all using (true) with check (true);
