create table if not exists public.game_state (
  id text primary key,
  data jsonb not null,
  version int not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.game_state enable row level security;
