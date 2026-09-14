-- Optional later target. The running classroom app uses a file-backed store
-- with the same fields. Enable RLS if you attach this to a hosted project.

create table if not exists sessions (
  id text primary key,
  code text not null unique,
  status text not null,
  current_round int not null,
  energy_per_round int not null,
  costs jsonb not null,
  influence_thresholds jsonb not null,
  weights jsonb not null,
  platform_value bigint not null default 0,
  flags jsonb not null,
  announcement text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists participants (
  id text primary key,
  session_id text not null references sessions(id) on delete cascade,
  username text not null,
  token text not null unique,
  influence int not null default 0,
  energy int not null default 0,
  rank int not null default 0,
  boosts_used_this_round int not null default 0,
  pins_used_this_round int not null default 0,
  broadcasts_used_this_round int not null default 0,
  kicked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (session_id, username)
);

create table if not exists posts (
  id text primary key,
  session_id text not null references sessions(id) on delete cascade,
  author_id text not null references participants(id),
  parent_id text references posts(id) on delete cascade,
  group_id text,
  body text not null,
  liked_by jsonb not null default '[]',
  views_display int not null default 1,
  visibility_score numeric not null default 0,
  influence_earned int not null default 0,
  tags text[] not null default '{}',
  boosted boolean not null default false,
  buried boolean not null default false,
  trending boolean not null default false,
  pinned_until timestamptz,
  mentioned_ids text[] not null default '{}',
  is_broadcast boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists groups (
  id text primary key,
  session_id text not null references sessions(id) on delete cascade,
  name text not null,
  creator_id text not null references participants(id),
  member_ids text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists proposals (
  id text primary key,
  session_id text not null references sessions(id) on delete cascade,
  author_id text not null references participants(id),
  title text not null,
  body text not null default '',
  effect text not null,
  status text not null,
  votes jsonb not null default '{}',
  threshold int not null,
  created_at timestamptz not null default now()
);

create table if not exists announcements (
  id text primary key,
  session_id text not null references sessions(id) on delete cascade,
  body text not null,
  kind text not null,
  created_at timestamptz not null default now()
);

create table if not exists events (
  id text primary key,
  session_id text not null references sessions(id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);

alter table sessions enable row level security;
alter table participants enable row level security;
alter table posts enable row level security;
alter table groups enable row level security;
alter table proposals enable row level security;
alter table announcements enable row level security;
alter table events enable row level security;
