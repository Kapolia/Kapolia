# supabase/

Ce dossier versionne la configuration de sécurité Supabase qui vit normalement
uniquement dans le dashboard — invisible dans le code, impossible à auditer en PR,
perdue si le projet Supabase est supprimé ou recréé.

## policies.sql

Snapshot des politiques Row-Level Security (RLS) capturées le **21/07/2026**.

### Tables couvertes

| Table | Politiques | Notes |
|---|---|---|
| `public.candidatures` | 4 | Dont 1 doublon à nettoyer (voir commentaire dans le fichier) |
| `public.conversations` | 1 | |
| `public.messages` | 1 | |
| `public.offres` | 2 | |
| `public.offres_favorites` | 3 | |
| `public.profils` | 2 | |
| `public.reactions` | 3 | |
| `public.vues_profil` | 2 | |
| `storage.objects` | 2 | Capture potentiellement incomplète — vérifier les buckets `pieces-jointes` et `avatars` (upload/delete) |

### Comment appliquer ce fichier sur une nouvelle instance

Dans l'éditeur SQL du dashboard Supabase cible, copier-coller le contenu
de `policies.sql` et exécuter. Les `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
sont inclus pour chaque table publique.

> **Note storage** : ne pas exécuter les politiques `storage.objects` si la
> nouvelle instance utilise une version de Supabase qui gère déjà le RLS sur
> cette table en interne. En cas de doute, les ajouter via Interface > Storage >
> Policies plutôt que via SQL.

### Comment régénérer ce fichier

Depuis l'éditeur SQL du dashboard Supabase, exécuter la requête suivante et
remplacer le contenu de `policies.sql` avec le résultat :

```sql
SELECT
  'CREATE POLICY "' || policyname || '" ON ' || schemaname || '.' || tablename ||
  ' AS ' || permissive ||
  ' FOR ' || cmd ||
  ' TO ' || array_to_string(roles, ', ') ||
  CASE WHEN qual       IS NOT NULL THEN E'\n  USING ('       || qual       || ')' ELSE '' END ||
  CASE WHEN with_check IS NOT NULL THEN E'\n  WITH CHECK (' || with_check || ')' ELSE '' END ||
  ';'
FROM pg_policies
ORDER BY schemaname, tablename, policyname;
```

Mettre à jour la date de capture dans l'en-tête du fichier, puis committer.

### ⚠️ Règle de mise à jour — à respecter impérativement

**Ce fichier doit être mis à jour à chaque changement de politique RLS.**

Toute modification dans le dashboard Supabase (ajout, suppression ou modification
d'une politique) doit être suivie d'un commit mettant à jour `policies.sql`.
Sans cette discipline, le fichier dérive de la réalité et perd son utilité :
il donne une fausse assurance de sécurité documentée.

Checklist à chaque changement de RLS dans Supabase :
1. Modifier la politique dans le dashboard
2. Régénérer `policies.sql` via la requête ci-dessus
3. Committer avec un message explicite : `security: [description du changement RLS]`
