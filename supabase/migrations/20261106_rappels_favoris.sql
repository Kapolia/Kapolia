alter table public.offres_favorites
  add column if not exists rappel_24h_at timestamptz,
  add column if not exists rappel_3j_at  timestamptz;

alter table public.profils
  add column if not exists rappels_favoris boolean not null default true;
