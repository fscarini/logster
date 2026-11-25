create table public.routes (
  id uuid primary key,
  owner_id uuid references auth.users(id) on delete cascade,
  code text not null check (char_length(code) between 1 and 24),
  origin text not null check (char_length(origin) between 1 and 80),
  destination text not null check (char_length(destination) between 1 and 80),
  checkpoint text not null check (char_length(checkpoint) between 1 and 90),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  checkpoint_minutes integer not null check (checkpoint_minutes between 0 and 2880)
);

create table public.deliveries (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  route_id uuid not null references public.routes(id) on delete cascade,
  reference text not null check (char_length(reference) between 1 and 60),
  departure_at timestamptz not null,
  hour_cost_cents integer not null check (hour_cost_cents between 0 and 10000000),
  unique (owner_id, id)
);

create table public.forecasts (
  route_id uuid primary key references public.routes(id) on delete cascade,
  fetched_at timestamptz not null,
  hours jsonb not null check (jsonb_typeof(hours) = 'array')
);

create table public.decisions (
  delivery_id uuid primary key,
  owner_id uuid not null,
  choice text not null check (choice in ('advance', 'postpone', 'reroute')),
  note text not null check (char_length(note) <= 350),
  recorded_at timestamptz not null default now(),
  assessment jsonb not null check (jsonb_typeof(assessment) = 'object'),
  foreign key (owner_id, delivery_id) references public.deliveries(owner_id, id) on delete cascade
);

create index routes_owner_id_idx on public.routes (owner_id);
create index deliveries_owner_departure_idx on public.deliveries (owner_id, departure_at);
create index deliveries_route_idx on public.deliveries (route_id);
create index decisions_owner_id_idx on public.decisions (owner_id);

alter table public.routes enable row level security;
alter table public.deliveries enable row level security;
alter table public.forecasts enable row level security;
alter table public.decisions enable row level security;

revoke all on public.routes, public.deliveries, public.forecasts, public.decisions from anon, authenticated;
grant select, insert on public.routes, public.deliveries, public.decisions to authenticated;
grant select on public.forecasts to authenticated;
grant select on public.routes to service_role;
grant select, insert, update on public.forecasts to service_role;

create policy read_routes on public.routes for select to authenticated
  using (owner_id is null or owner_id = (select auth.uid()));
create policy insert_own_routes on public.routes for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy read_own_deliveries on public.deliveries for select to authenticated
  using (owner_id = (select auth.uid()));
create policy insert_own_deliveries on public.deliveries for insert to authenticated
  with check (owner_id = (select auth.uid()) and exists (
    select 1 from public.routes where routes.id = deliveries.route_id
  ));

create policy read_route_forecasts on public.forecasts for select to authenticated
  using (exists (select 1 from public.routes where routes.id = forecasts.route_id));

create policy read_own_decisions on public.decisions for select to authenticated
  using (owner_id = (select auth.uid()));
create policy insert_own_decisions on public.decisions for insert to authenticated
  with check (owner_id = (select auth.uid()) and exists (
    select 1 from public.deliveries where deliveries.id = decisions.delivery_id
  ));

insert into public.routes (id, code, origin, destination, checkpoint, latitude, longitude, checkpoint_minutes)
values
  ('00000000-0000-4000-8000-000000000116', 'BR-116', 'São Paulo', 'Curitiba', 'Serra do Cafezal', -23.975, -47.155, 120),
  ('00000000-0000-4000-8000-000000000101', 'BR-101', 'Curitiba', 'Joinville', 'Garuva', -26.034, -48.851, 90),
  ('00000000-0000-4000-8000-000000000381', 'BR-381', 'Belo Horizonte', 'São Paulo', 'Cambuí', -22.612, -46.058, 300);
