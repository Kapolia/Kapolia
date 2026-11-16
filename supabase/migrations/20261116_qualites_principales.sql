ALTER TABLE profils
  ADD COLUMN IF NOT EXISTS qualites_principales text[] DEFAULT NULL;
