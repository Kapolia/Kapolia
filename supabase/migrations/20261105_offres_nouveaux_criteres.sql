-- Migration : nouveaux critères sur public.offres
-- Critères déjà présents (ne pas recréer) : langues (text[]), duree_contrat (text)
-- Aucune modification de : profils, politiques RLS, colonne teletravail

BEGIN;

-- ── Nouvelles colonnes ────────────────────────────────────────────────────────

ALTER TABLE public.offres
  ADD COLUMN IF NOT EXISTS temps_travail    text,
  ADD COLUMN IF NOT EXISTS horaires         text[]    NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS permis           text[]    NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS statut_cadre     boolean   NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS logement_fourni  boolean   NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS repas_fournis    boolean   NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ouvert_handicap  boolean   NOT NULL DEFAULT false;

-- ── Contraintes CHECK (ajoutées seulement si absentes) ────────────────────────

DO $$
BEGIN

  -- temps_travail : null autorisé, sinon valeur dans le référentiel
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.offres'::regclass
      AND conname  = 'offres_temps_travail_check'
  ) THEN
    ALTER TABLE public.offres
      ADD CONSTRAINT offres_temps_travail_check
        CHECK (
          temps_travail IS NULL
          OR temps_travail IN ('temps_plein', 'temps_partiel')
        );
  END IF;

  -- horaires : chaque élément doit appartenir au référentiel
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.offres'::regclass
      AND conname  = 'offres_horaires_check'
  ) THEN
    ALTER TABLE public.offres
      ADD CONSTRAINT offres_horaires_check
        CHECK (
          horaires <@ ARRAY['journee', 'nuit', 'week_end', 'equipes']::text[]
        );
  END IF;

  -- permis : chaque élément doit appartenir au référentiel
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.offres'::regclass
      AND conname  = 'offres_permis_check'
  ) THEN
    ALTER TABLE public.offres
      ADD CONSTRAINT offres_permis_check
        CHECK (
          permis <@ ARRAY['B', 'C_CE', 'D', 'CACES']::text[]
        );
  END IF;

END $$;

COMMIT;
