-- ============================================================
-- supabase/policies.sql
--
-- Snapshot des politiques Row-Level Security (RLS) de production
-- Date de capture : 21/07/2026
--
-- Rôle : rejouer ce fichier pour recréer la configuration de
--   sécurité sur une nouvelle instance Supabase (staging,
--   migration de projet, restauration après incident).
--
-- ⚠️  RÈGLE : mettre à jour ce fichier à chaque changement de
--   politique dans le dashboard Supabase, puis committer.
--
-- 25 politiques au total : 18 sur schéma public, 7 sur storage.
-- ============================================================


-- ===== TABLE : public.candidatures ============================

ALTER TABLE public.candidatures ENABLE ROW LEVEL SECURITY;

-- Candidat : accès complet (lecture, insertion, suppression) à ses propres candidatures
CREATE POLICY "Candidat gère ses candidatures"
  ON public.candidatures AS PERMISSIVE FOR ALL
  TO public
  USING (auth.uid() = candidat_id)
  WITH CHECK (auth.uid() = candidat_id);

-- Recruteur : lecture des candidatures reçues sur ses offres
CREATE POLICY "Recruteur peut voir ses candidatures"
  ON public.candidatures AS PERMISSIVE FOR SELECT
  TO public
  USING (EXISTS (
    SELECT 1 FROM offres
    WHERE offres.id          = candidatures.offre_id
      AND offres.recruteur_id = auth.uid()
  ));

-- ⚠️  DOUBLON — clause USING identique à "Recruteur peut voir ses candidatures".
--   À supprimer dans le dashboard Supabase pour nettoyer la configuration.
CREATE POLICY "Recruteur voit les candidatures"
  ON public.candidatures AS PERMISSIVE FOR SELECT
  TO public
  USING (EXISTS (
    SELECT 1 FROM offres
    WHERE offres.id          = candidatures.offre_id
      AND offres.recruteur_id = auth.uid()
  ));

-- Recruteur : mise à jour du statut des candidatures reçues sur ses offres
CREATE POLICY "Recruteur peut modifier statut candidatures"
  ON public.candidatures AS PERMISSIVE FOR UPDATE
  TO public
  USING (EXISTS (
    SELECT 1 FROM offres
    WHERE offres.id          = candidatures.offre_id
      AND offres.recruteur_id = auth.uid()
  ));


-- ===== TABLE : public.conversations ===========================
--
-- SCHÉMA — colonnes ajoutées :
--
--   (2026-08-12) masquage soft-delete :
--   ALTER TABLE public.conversations
--     ADD COLUMN IF NOT EXISTS masquee_candidat  boolean NOT NULL DEFAULT false,
--     ADD COLUMN IF NOT EXISTS masquee_recruteur boolean NOT NULL DEFAULT false;
--
--   Ces colonnes remplacent le DELETE réel par un masquage côté client :
--     - candidat  : UPDATE masquee_candidat  = true  (ne détruit pas les données recruteur)
--     - recruteur : UPDATE masquee_recruteur = true  (ne détruit pas les données candidat)
--   Chaque page filtre .eq('masquee_candidat', false) / .eq('masquee_recruteur', false)
--   au chargement. Les conversations masquées des deux côtés sont orphelines
--   (nettoyage possible via job planifié, non implémenté).
--   Recevoir un nouveau message dé-masque automatiquement la conversation via trigger.
--
--   (2026-08-12) compteurs de non-lus séparés par participant :
--   ALTER TABLE public.conversations
--     ADD COLUMN IF NOT EXISTS non_lu_candidat  integer NOT NULL DEFAULT 0,
--     ADD COLUMN IF NOT EXISTS non_lu_recruteur integer NOT NULL DEFAULT 0;
--
--   Remplacent l'ancienne colonne non_lu (gardée pour rétrocompatibilité, non supprimée).
--   non_lu_candidat  = messages non lus par le candidat  (incrémenté par le recruteur)
--   non_lu_recruteur = messages non lus par le recruteur (incrémenté par le candidat)
--   Mis à jour par le trigger maj_conversation_apres_message (SECURITY DEFINER).
--   Réinitialisés à 0 par chaque participant à l'ouverture de sa propre conversation.
--
-- TRIGGER — maj_conversation_apres_message (SECURITY DEFINER, après INSERT messages) :
--   Met à jour dernier_message, derniere_activite, non_lu_candidat, non_lu_recruteur,
--   masquee_candidat et masquee_recruteur en une seule UPDATE atomique.
--   CREATE OR REPLACE FUNCTION public.maj_conversation_apres_message()
--   RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $function$
--   BEGIN
--     UPDATE conversations
--     SET dernier_message   = LEFT(COALESCE(NEW.contenu, 'Pièce jointe'), 100),
--         derniere_activite = NEW.created_at,
--         non_lu_candidat   = CASE WHEN recruteur_id = NEW.expediteur_id
--                                  THEN non_lu_candidat + 1 ELSE non_lu_candidat END,
--         non_lu_recruteur  = CASE WHEN candidat_id  = NEW.expediteur_id
--                                  THEN non_lu_recruteur + 1 ELSE non_lu_recruteur END,
--         masquee_candidat  = CASE WHEN recruteur_id = NEW.expediteur_id THEN false ELSE masquee_candidat END,
--         masquee_recruteur = CASE WHEN candidat_id  = NEW.expediteur_id THEN false ELSE masquee_recruteur END
--     WHERE id = NEW.conversation_id;
--     RETURN NEW;
--   END;
--   $function$;
--
-- ⚠️  TODO SPRINT SÉCURITÉ PRÉ-LANCEMENT — durcissement RLS column-level :
--   La policy "Accès conversations" (FOR ALL) autorise actuellement le candidat
--   à écrire masquee_RECRUTEUR et vice-versa via l'API Supabase directe.
--   Corriger avec deux policies UPDATE séparées :
--     - candidat  : WITH CHECK (auth.uid() = candidat_id)  sur masquee_candidat seulement
--     - recruteur : WITH CHECK (auth.uid() = recruteur_id) sur masquee_recruteur seulement
--   Supprimer la policy FOR ALL et la remplacer par SELECT + INSERT + DELETE + UPDATE(x2).

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- Candidat et recruteur : accès complet à leurs conversations communes
-- (voir TODO ci-dessus pour le durcissement à faire sur UPDATE)
CREATE POLICY "Accès conversations"
  ON public.conversations AS PERMISSIVE FOR ALL
  TO public
  USING ((auth.uid() = candidat_id) OR (auth.uid() = recruteur_id))
  WITH CHECK ((auth.uid() = candidat_id) OR (auth.uid() = recruteur_id));


-- ===== TABLE : public.messages ================================
--
-- SCHÉMA — colonnes : id, conversation_id, expediteur_id, contenu,
--   lu, created_at, piece_jointe_url, piece_jointe_nom,
--   piece_jointe_type, reply_to_id
--
-- SPRINT SÉCURITÉ (2026-08-17) — 3 opérations :
--
-- 1. DROP "destinataire peut marquer lu" (qual=null, with_check=null)
--    Policy fantôme PERMISSIVE FOR ALL sans aucune condition =
--    accès complet à tous les messages pour tout utilisateur authentifié.
--    Faille grave supprimée.
--
-- 2. DROP + RECREATE "membres peuvent marquer lu" (UPDATE)
--    Avant : WITH CHECK(true) → n'importe quelle colonne modifiable.
--    Après : WITH CHECK(lu = true) → seul le passage à lu=true est permis.
--    Le WITH CHECK n'ayant pas accès à OLD, le trigger ci-dessous
--    complète la protection colonne par colonne.
--
-- 3. CREATE TRIGGER enforce_message_lu_only (BEFORE UPDATE)
--    Bloque toute modification sur messages sauf la colonne lu.
--    Accède à OLD et NEW, raise exception si une autre colonne change.
--    Couvre toutes les colonnes de la table sauf lu.

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Membres d'une conversation : lecture de tous ses messages,
-- écriture uniquement de ses propres messages (expediteur_id = auth.uid())
CREATE POLICY "Accès messages"
  ON public.messages AS PERMISSIVE FOR ALL
  TO public
  USING (EXISTS (
    SELECT 1 FROM conversations
    WHERE conversations.id = messages.conversation_id
      AND (conversations.candidat_id  = auth.uid()
        OR conversations.recruteur_id = auth.uid())
  ))
  WITH CHECK (auth.uid() = expediteur_id);

-- Membres d'une conversation : marquer un message comme lu
-- USING : le message doit appartenir à une conversation dont l'utilisateur est membre
-- WITH CHECK : seul lu=true est autorisé — le trigger enforce_message_lu_only
--   empêche toute modification des autres colonnes (contenu, expediteur_id, etc.)
CREATE POLICY "membres peuvent marquer lu"
  ON public.messages AS PERMISSIVE FOR UPDATE
  TO public
  USING (EXISTS (
    SELECT 1 FROM conversations
    WHERE conversations.id          = messages.conversation_id
      AND (conversations.candidat_id  = auth.uid()
        OR conversations.recruteur_id = auth.uid())
  ))
  WITH CHECK (lu = true);

-- Trigger BEFORE UPDATE : seule la colonne lu peut être modifiée.
-- Le WITH CHECK n'ayant pas accès à OLD, ce trigger est la seule façon
-- de garantir qu'aucune autre colonne n'est altérée lors d'un UPDATE.
-- Colonnes protégées : toutes sauf lu.
--
-- CREATE OR REPLACE FUNCTION public.enforce_message_lu_only()
-- RETURNS trigger LANGUAGE plpgsql SET search_path = 'public' AS $$
-- BEGIN
--   IF NEW.id                IS DISTINCT FROM OLD.id                OR
--      NEW.conversation_id   IS DISTINCT FROM OLD.conversation_id   OR
--      NEW.expediteur_id     IS DISTINCT FROM OLD.expediteur_id     OR
--      NEW.contenu           IS DISTINCT FROM OLD.contenu           OR
--      NEW.created_at        IS DISTINCT FROM OLD.created_at        OR
--      NEW.piece_jointe_url  IS DISTINCT FROM OLD.piece_jointe_url  OR
--      NEW.piece_jointe_nom  IS DISTINCT FROM OLD.piece_jointe_nom  OR
--      NEW.piece_jointe_type IS DISTINCT FROM OLD.piece_jointe_type OR
--      NEW.reply_to_id       IS DISTINCT FROM OLD.reply_to_id
--   THEN
--     RAISE EXCEPTION 'seule la colonne lu peut être modifiée sur messages';
--   END IF;
--   RETURN NEW;
-- END;
-- $$;
--
-- CREATE TRIGGER enforce_message_lu_only
--   BEFORE UPDATE ON public.messages
--   FOR EACH ROW
--   EXECUTE FUNCTION public.enforce_message_lu_only();


-- ===== TABLE : public.offres ==================================

ALTER TABLE public.offres ENABLE ROW LEVEL SECURITY;

-- Tout le monde (y compris anonyme) : lecture des offres sans restriction
CREATE POLICY "Lecture publique offres"
  ON public.offres AS PERMISSIVE FOR SELECT
  TO public
  USING (true);

-- Recruteur : accès complet (création, modification, suppression) à ses propres offres
--
-- ⚠️  IMPACT SUR LA PAGE ADMIN (app/admin/page.tsx) :
--   Les opérations toggleOffre() et deleteOffre() ciblent des offres dont
--   recruteur_id ≠ auth.uid() de l'admin. Aucune politique admin n'étant
--   présente dans cette capture, ces requêtes échouent silencieusement côté
--   RLS — le DELETE/UPDATE ne s'applique qu'aux offres créées par l'admin lui-même.
--   Ajouter une politique admin-only si ces opérations doivent fonctionner.
CREATE POLICY "Recruteur gère ses offres"
  ON public.offres AS PERMISSIVE FOR ALL
  TO public
  USING (auth.uid() = recruteur_id)
  WITH CHECK (auth.uid() = recruteur_id);


-- ===== TABLE : public.offres_favorites ========================

ALTER TABLE public.offres_favorites ENABLE ROW LEVEL SECURITY;

-- Candidat : ajout d'une offre en favori (candidat_id doit correspondre à l'utilisateur)
CREATE POLICY "candidat_ajoute_ses_favoris"
  ON public.offres_favorites AS PERMISSIVE FOR INSERT
  TO public
  WITH CHECK (candidat_id = auth.uid());

-- Candidat : suppression d'un de ses favoris
CREATE POLICY "candidat_retire_ses_favoris"
  ON public.offres_favorites AS PERMISSIVE FOR DELETE
  TO public
  USING (candidat_id = auth.uid());

-- Candidat : lecture de ses favoris
CREATE POLICY "candidat_voit_ses_favoris"
  ON public.offres_favorites AS PERMISSIVE FOR SELECT
  TO public
  USING (candidat_id = auth.uid());


-- ===== TABLE : public.profils =================================

ALTER TABLE public.profils ENABLE ROW LEVEL SECURITY;

-- Utilisateur : accès complet (lecture, modification, suppression) à son propre profil
--
-- ⚠️  IMPACT SUR LA PAGE ADMIN (app/admin/page.tsx) :
--   La fonction deleteProfil() supprime le profil d'un autre utilisateur via
--   .eq('user_id', userId). Cette politique n'autorise que auth.uid() = user_id,
--   donc le DELETE est filtré silencieusement par RLS et ne s'exécute pas.
--   Ajouter une politique admin-only si la suppression de profils tiers doit
--   fonctionner depuis l'interface d'administration.
CREATE POLICY "Accès profil propre"
  ON public.profils AS PERMISSIVE FOR ALL
  TO public
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Recruteur : lecture des profils des candidats ayant postulé sur ses offres
-- (le recruteur peut également lire son propre profil via la clause OR)
CREATE POLICY "Recruteur peut voir profils candidats"
  ON public.profils AS PERMISSIVE FOR SELECT
  TO public
  USING (
    (auth.uid() = user_id)
    OR EXISTS (
      SELECT 1
      FROM candidatures
      JOIN offres ON offres.id = candidatures.offre_id
      WHERE candidatures.candidat_id = profils.user_id
        AND offres.recruteur_id      = auth.uid()
    )
  );


-- ===== TABLE : public.reactions ===============================

ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;

-- Membre authentifié d'une conversation : ajout d'une réaction à un message
CREATE POLICY "membre ajoute sa reaction"
  ON public.reactions AS PERMISSIVE FOR INSERT
  TO authenticated
  WITH CHECK (
    (user_id = auth.uid())
    AND EXISTS (
      SELECT 1
      FROM messages m
      JOIN conversations c ON c.id = m.conversation_id
      WHERE m.id = reactions.message_id
        AND (c.recruteur_id = auth.uid() OR c.candidat_id = auth.uid())
    )
  );

-- Membre : suppression de sa propre réaction uniquement
CREATE POLICY "membre retire sa reaction"
  ON public.reactions AS PERMISSIVE FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Membre d'une conversation : lecture des réactions sur les messages de la conversation
CREATE POLICY "membres voient reactions"
  ON public.reactions AS PERMISSIVE FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1
    FROM messages m
    JOIN conversations c ON c.id = m.conversation_id
    WHERE m.id = reactions.message_id
      AND (c.recruteur_id = auth.uid() OR c.candidat_id = auth.uid())
  ));


-- ===== TABLE : public.vues_profil =============================

ALTER TABLE public.vues_profil ENABLE ROW LEVEL SECURITY;

-- Visiteur authentifié : enregistrement d'une vue sur un profil
-- (visiteur_id doit correspondre à l'utilisateur qui effectue la requête)
CREATE POLICY "Insertion vue"
  ON public.vues_profil AS PERMISSIVE FOR INSERT
  TO public
  WITH CHECK (auth.uid() = visiteur_id);

-- Propriétaire du profil : lecture des vues reçues sur son propre profil
CREATE POLICY "Lecture vues propres"
  ON public.vues_profil AS PERMISSIVE FOR SELECT
  TO public
  USING (auth.uid() = profil_id);


-- ===== STORAGE : storage.objects ==============================
--
-- Les politiques de stockage s'appliquent à `storage.objects` (schéma `storage`).
-- ALTER TABLE ENABLE ROW LEVEL SECURITY est géré par Supabase en interne
-- sur cette table — ne pas l'exécuter manuellement sur une nouvelle instance.
--
-- 7 politiques couvrant les buckets `avatars` et `projets-medias`.
-- Convention de chemin : le premier segment (storage.foldername(name)[1])
-- doit correspondre à auth.uid(), ce qui isole chaque utilisateur dans son dossier.

-- Bucket `avatars` — lecture publique (pas d'authentification requise)
CREATE POLICY "Lecture avatars publique"
  ON storage.objects AS PERMISSIVE FOR SELECT
  TO public
  USING (bucket_id = 'avatars'::text);

-- Bucket `avatars` — upload dans son propre dossier
CREATE POLICY "Upload avatar propre"
  ON storage.objects AS PERMISSIVE FOR INSERT
  TO public
  WITH CHECK (
    bucket_id = 'avatars'::text
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

-- Bucket `avatars` — remplacement de son propre avatar
CREATE POLICY "Mise à jour avatar propre"
  ON storage.objects AS PERMISSIVE FOR UPDATE
  TO public
  USING (
    bucket_id = 'avatars'::text
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

-- Bucket `avatars` — suppression de son propre avatar
CREATE POLICY "Suppression avatar propre"
  ON storage.objects AS PERMISSIVE FOR DELETE
  TO public
  USING (
    bucket_id = 'avatars'::text
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

-- Bucket `projets-medias` — upload dans son propre dossier
CREATE POLICY "Upload media propre"
  ON storage.objects AS PERMISSIVE FOR INSERT
  TO public
  WITH CHECK (
    bucket_id = 'projets-medias'::text
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

-- Bucket `projets-medias` — remplacement d'un fichier existant
CREATE POLICY "Mise a jour media propre"
  ON storage.objects AS PERMISSIVE FOR UPDATE
  TO public
  USING (
    bucket_id = 'projets-medias'::text
    AND (auth.uid())::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'projets-medias'::text
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

-- Bucket `projets-medias` — suppression de son propre fichier
CREATE POLICY "Suppression media propre"
  ON storage.objects AS PERMISSIVE FOR DELETE
  TO public
  USING (
    bucket_id = 'projets-medias'::text
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );
