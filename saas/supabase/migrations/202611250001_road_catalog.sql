-- Rotas pré-estabelecidas a partir do catálogo rodoviário (SNV/DNIT + municípios do IBGE).
-- O traçado é recalculado pelo servidor a partir dos códigos; o banco guarda apenas a escolha.
alter table public.routes
  add column origin_code integer check (origin_code between 1100000 and 5399999),
  add column destination_code integer check (destination_code between 1100000 and 5399999),
  add column checkpoint_snv text check (char_length(checkpoint_snv) <= 16),
  add constraint routes_catalog_pair check (
    (origin_code is null and destination_code is null)
    or (origin_code is not null and destination_code is not null and origin_code <> destination_code)
  );

update public.routes set origin_code = 3550308, destination_code = 4106902 where id = '00000000-0000-4000-8000-000000000116';
update public.routes set origin_code = 4106902, destination_code = 4209102 where id = '00000000-0000-4000-8000-000000000101';
update public.routes set origin_code = 3106200, destination_code = 3550308 where id = '00000000-0000-4000-8000-000000000381';
