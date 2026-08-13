/**
 * Teste l'upsert final de l'onboarding candidat avec des données réalistes.
 * Vérifie que TOUTES les colonnes existent en base et se sauvegardent correctement.
 *
 * Usage :
 *   SEED_EMAIL=candidat@example.com SEED_PASSWORD=xxx npx tsx scripts/seed-profil-test.ts
 *
 * Le compte doit exister dans Supabase Auth (type_compte = 'candidat').
 * Utilisez le compte candidat de test habituel.
 */

import './env'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SEED_EMAIL    = process.env.SEED_EMAIL
const SEED_PASSWORD = process.env.SEED_PASSWORD

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌  Variables Supabase introuvables dans .env.local.')
  console.error('    Vérifiez que .env.local contient NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY.')
  process.exit(1)
}
if (!SEED_EMAIL || !SEED_PASSWORD) {
  console.error('❌  SEED_EMAIL et SEED_PASSWORD requis.')
  console.error('    Usage : SEED_EMAIL=candidat@test.com SEED_PASSWORD=motdepasse npx tsx scripts/seed-profil-test.ts')
  process.exit(1)
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY)

// ─── Payload — miroir exact du upsert de handleNext() dans onboarding/page.tsx ─

const PROFIL_TEST = {
  type_compte: 'candidat',
  prenom: 'Sophie',
  nom: 'Marchand',
  domaine: 'Tech & Ingénierie',
  experience: '3–5 ans',
  signature: 'Développeuse fullstack passée par une école de commerce avant de me reconvertir via une formation intensive. J\'aime construire des produits qu\'on utilise vraiment.',
  qualites: ['Curieuse', 'Fiable', 'Directe'],
  mode_travail: ['startup'],
  valeur: 'action',
  projet_phare: 'J\'ai construit une app de suivi de budget collaboratif pour ma famille élargie — 12 utilisateurs actifs, déployée sur Vercel, intégration avec l\'API Open Banking. Premier vrai projet "en prod".',
  passions: ['Escalade', 'Podcast true crime', 'Cuisine coréenne'],
  side_project: 'Un bot Discord qui résume les fils de discussion longs pour les équipes async. En cours.',
  type_poste: ['cdi'],
  structure: 'hybride',
  ville: 'Lyon',
  priorites: ['Apprentissage continu', 'Équipe soudée', 'Autonomie'],
  disponibilite: 'a_partir_de',
  dispo_date: '2026-09-01',
  experiences: [
    {
      poste: 'Développeuse Frontend',
      entreprise: 'Agence Pixel',
      date_debut: 'Jan 2023',
      date_fin: 'Déc 2024',
      en_poste: false,
      missions: 'Refonte de 3 sites clients en Next.js\nIntégration Figma → composants React\nMise en place de tests E2E avec Playwright',
    },
    {
      poste: 'Chargée de projet digital',
      entreprise: 'MediGroup',
      date_debut: 'Sept 2021',
      date_fin: 'Déc 2022',
      en_poste: false,
      missions: 'Gestion du CRM et des outils marketing\nFormation des équipes aux nouveaux outils SaaS',
    },
  ],
  diplomes: [
    { intitule: 'Formation Développeur Web Fullstack', ecole: 'Le Wagon Lyon', annee: '2022', mention: '' },
    { intitule: 'Master Marketing & Communication', ecole: 'EM Lyon Business School', annee: '2021', mention: 'Bien' },
  ],
  competences_acquises: ['React', 'Next.js', 'TypeScript', 'Node.js', 'Supabase', 'Tailwind', 'Figma', 'Git'],
  langues: ['Français — Natif', 'Anglais — Courant', 'Espagnol — Intermédiaire'],
  onboarding_completed: true,
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🔐 Connexion avec ${SEED_EMAIL}…`)
  const { error: authError } = await sb.auth.signInWithPassword({
    email: SEED_EMAIL!,
    password: SEED_PASSWORD!,
  })
  if (authError) {
    console.error('❌  Connexion échouée :', authError.message)
    process.exit(1)
  }

  const { data: { user } } = await sb.auth.getUser()
  if (!user) {
    console.error('❌  Utilisateur introuvable après connexion.')
    process.exit(1)
  }
  console.log(`✓  Connecté — user_id : ${user.id}`)

  console.log('\n📝 Upsert du profil de test…')
  const { error: upsertError } = await sb.from('profils').upsert(
    { user_id: user.id, ...PROFIL_TEST },
    { onConflict: 'user_id' },
  )

  if (upsertError) {
    console.error('\n❌  Upsert échoué :', upsertError.message)
    console.error('    Code :', upsertError.code)
    console.error('    Détail :', upsertError.details)
    console.error('\n→  Vérifiez que les colonnes SQL ont bien été créées :')
    console.error('     ALTER TABLE public.profils ADD COLUMN IF NOT EXISTS priorites text[];')
    console.error('     ALTER TABLE public.profils ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false;')
    await sb.auth.signOut()
    process.exit(1)
  }

  console.log('✓  Upsert réussi\n')

  // Relecture pour confirmer ce qui est en base
  const { data: profil, error: fetchError } = await sb
    .from('profils')
    .select('prenom, nom, domaine, experience, signature, qualites, mode_travail, valeur, projet_phare, passions, side_project, type_poste, structure, ville, priorites, disponibilite, dispo_date, experiences, diplomes, competences_acquises, langues, onboarding_completed')
    .eq('user_id', user.id)
    .single()

  if (fetchError || !profil) {
    console.error('❌  Impossible de relire le profil :', fetchError?.message)
    await sb.auth.signOut()
    process.exit(1)
  }

  const fields = Object.keys(PROFIL_TEST) as (keyof typeof PROFIL_TEST)[]
  let allOk = true

  console.log('─'.repeat(52))
  console.log('Champ'.padEnd(28) + 'Statut')
  console.log('─'.repeat(52))

  for (const key of fields) {
    const val = (profil as Record<string, unknown>)[key]
    const empty = val === null || val === undefined || (Array.isArray(val) && val.length === 0) || val === ''
    const status = empty ? '⚠  vide/null' : '✓  OK'
    if (empty) allOk = false
    console.log(key.padEnd(28) + status)
  }

  console.log('─'.repeat(52))
  if (allOk) {
    console.log('\n✅  Tous les champs sont sauvegardés correctement.')
  } else {
    console.log('\n⚠  Certains champs sont vides — vérifiez les colonnes en base.')
  }

  await sb.auth.signOut()
}

main().catch(err => {
  console.error('❌  Erreur inattendue :', err)
  process.exit(1)
})
