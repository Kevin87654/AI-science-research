-- 001_init.sql —— 匿名会话与任务进度
--
-- 这份是**人写的源文件**（序号制），实际执行走连接器的 applyMigration，
-- 执行后会把投递记录复制到 cloudbase/migrations/。两套目录的关系见《数据库交接说明》§4.1。
--
-- 设计依据：
--   · 《数据库接入探针记录》§2 —— 单条 SQL 硬上限 8 秒；API Key 带 bypassrls，RLS 对我们无效
--   · 《数据库接入探针记录》§6 —— 不开 RLS 的表对低权限身份是敞开的
--
-- 两件事请特别注意：
--   1. 每张表都 enable row level security，且**故意不建任何 policy**。
--      我们的 API Key 是 service_role（BYPASSRLS），RLS 挡不住我们，也不指望挡我们；
--      RLS 在这里的作用是：万一将来引入浏览器端凭据或别的账号，这些表默认读不到任何行。
--   2. 归属过滤由应用层负责 —— 主键里已经含 user_id，Repository 的每个查询都必须带它。

create table if not exists public.sessions (
  user_id      uuid        primary key default gen_random_uuid(),
  token_hash   text        not null unique,
  account_type text        not null default 'anonymous'
                           check (account_type in ('anonymous', 'demo')),
  created_at   timestamptz not null default now(),
  expires_at   timestamptz
);

comment on table public.sessions is
  '匿名会话。token_hash 是令牌摘要，明文令牌不落库。account_type=demo 用于与真实匿名用户隔离。';

create table if not exists public.task_progress (
  user_id    uuid        not null references public.sessions (user_id) on delete cascade,
  roadmap_id text        not null check (length(roadmap_id) between 1 and 100),
  task_id    text        not null check (length(task_id) between 1 and 100),
  status     text        not null check (status in ('not-started', 'in-progress', 'completed', 'skipped')),
  note       text        check (note is null or length(note) <= 500),
  updated_at timestamptz not null default now(),
  primary key (user_id, roadmap_id, task_id)
);

comment on table public.task_progress is
  '任务进度。主键含 user_id；应用层必须带归属过滤（API Key 带 bypassrls，RLS 不替我们兜底）。';

create index if not exists task_progress_user_updated_idx
  on public.task_progress (user_id, updated_at desc);

alter table public.sessions      enable row level security;
alter table public.sessions      force  row level security;
alter table public.task_progress enable row level security;
alter table public.task_progress force  row level security;
