/**
 * Remplit les colonnes entreprise_* du profil de Paul (recruteur de test).
 * Usage : SEED_PASSWORD=xxx npx tsx scripts/seed-entreprise-test.ts
 *
 * Le compte doit exister dans Supabase Auth (type_compte = 'recruteur').
 */

import './env'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SEED_EMAIL    = 'PaulQuiquet@gmail.com'
const SEED_PASSWORD = process.env.SEED_PASSWORD

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌  Variables Supabase introuvables dans .env.local.')
  process.exit(1)
}
if (!SEED_PASSWORD) {
  console.error('❌  SEED_PASSWORD requis.')
  console.error('    Usage : SEED_PASSWORD=motdepasse npx tsx scripts/seed-entreprise-test.ts')
  process.exit(1)
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY)

// ─── Contenu de l'entreprise ──────────────────────────────────────────────────

const ENTREPRISE = {
  entreprise_nom:     'Meridian Studio',
  entreprise_secteur: 'Tech & SaaS B2B',
  entreprise_taille:  '11–50 salariés',
  entreprise_ville:   'Paris, France',
  entreprise_site:    'meridian.studio',
  entreprise_description: `Meridian Studio conçoit des outils de pilotage pour les équipes créatives et les agences en croissance. Fondée en 2020 par une équipe issue de Spotify, Figma et BlaBlaCar, nous avons une conviction simple : les meilleurs workflows restent invisibles.

Notre produit est utilisé par plus de 800 équipes en Europe — des studios indépendants jusqu'aux filiales créatives de groupes comme LVMH et Publicis. En 2025, nous avons levé 8 M€ pour accélérer notre expansion et renforcer nos équipes produit, ingénierie et go-to-market.

Nous recrutons des profils qui aiment construire des choses solides, qui savent naviguer dans l'ambiguïté et qui ont un point de vue. Pas de bullshit, pas de culture de la réunion — juste des gens bons qui s'apprécient.`,
  entreprise_valeurs: [
    'Exigence bienveillante',
    'Impact direct',
    'Transparence radicale',
    'Craft & durabilité',
  ],
}

// ─── Aperçu console ───────────────────────────────────────────────────────────

function preview() {
  console.log('\n' + '═'.repeat(58))
  console.log('  CONTENU ENTREPRISE QUI SERA INSÉRÉ')
  console.log('═'.repeat(58))
  console.log(`  Nom       : ${ENTREPRISE.entreprise_nom}`)
  console.log(`  Secteur   : ${ENTREPRISE.entreprise_secteur}`)
  console.log(`  Taille    : ${ENTREPRISE.entreprise_taille}`)
  console.log(`  Ville     : ${ENTREPRISE.entreprise_ville}`)
  console.log(`  Site      : ${ENTREPRISE.entreprise_site}`)
  console.log(`  Valeurs   : ${ENTREPRISE.entreprise_valeurs.join(' · ')}`)
  console.log(`\n  Description (extrait) :`)
  const firstPara = ENTREPRISE.entreprise_description.split('\n\n')[0]
  const excerpt = firstPara.length > 160 ? firstPara.slice(0, 157) + '…' : firstPara
  console.log(`  ${excerpt}`)
  console.log('═'.repeat(58) + '\n')
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  preview()

  console.log(`🔐 Connexion avec ${SEED_EMAIL}…`)
  const { error: authError } = await sb.auth.signInWithPassword({
    email: SEED_EMAIL,
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
  console.log(`✓  Connecté — user_id : ${user.id}\n`)

  // Vérifier que c'est bien un recruteur
  const { data: profil } = await sb
    .from('profils')
    .select('type_compte, prenom, nom')
    .eq('user_id', user.id)
    .single()

  if (!profil) {
    console.error('❌  Profil introuvable en base.')
    process.exit(1)
  }
  if (profil.type_compte !== 'recruteur') {
    console.error(`❌  Ce compte est de type "${profil.type_compte}", attendu "recruteur".`)
    process.exit(1)
  }
  console.log(`👤 Profil trouvé : ${profil.prenom ?? ''} ${profil.nom ?? ''} (${profil.type_compte})`)

  // Update — uniquement les colonnes entreprise_*
  console.log('\n📝 Mise à jour des colonnes entreprise_*…')
  const { error: updateError } = await sb
    .from('profils')
    .update(ENTREPRISE)
    .eq('user_id', user.id)

  if (updateError) {
    console.error('\n❌  Update échoué :', updateError.message)
    console.error('    Code    :', updateError.code)
    console.error('    Détail  :', updateError.details)
    console.error('\n→  Vérifiez que les colonnes SQL existent (voir SQL dans la doc).')
    await sb.auth.signOut()
    process.exit(1)
  }

  // Relecture de confirmation
  const { data: updated, error: fetchErr } = await sb
    .from('profils')
    .select('entreprise_nom, entreprise_secteur, entreprise_taille, entreprise_ville, entreprise_site, entreprise_description, entreprise_valeurs, entreprise_logo_url')
    .eq('user_id', user.id)
    .single()

  if (fetchErr || !updated) {
    console.error('❌  Impossible de relire le profil :', fetchErr?.message)
    await sb.auth.signOut()
    process.exit(1)
  }

  console.log('\n' + '─'.repeat(52))
  console.log('Champ'.padEnd(28) + 'Statut')
  console.log('─'.repeat(52))

  const fields = Object.keys(ENTREPRISE) as (keyof typeof ENTREPRISE)[]
  let allOk = true
  for (const key of fields) {
    const val = (updated as Record<string, unknown>)[key]
    const empty = val === null || val === undefined || (Array.isArray(val) && val.length === 0) || val === ''
    if (empty) allOk = false
    console.log(key.padEnd(28) + (empty ? '⚠  vide/null' : '✓  OK'))
  }

  // Logo (non seedé — info manuelle)
  const logoStatus = updated.entreprise_logo_url
    ? `✓  ${String(updated.entreprise_logo_url).slice(0, 40)}…`
    : '—  (pas de logo — à uploader via le formulaire)'
  console.log('entreprise_logo_url'.padEnd(28) + logoStatus)

  console.log('─'.repeat(52))

  if (allOk) {
    console.log('\n✅  Tous les champs entreprise sont en base.')
  } else {
    console.log('\n⚠  Certains champs sont vides — vérifiez les colonnes SQL.')
  }

  // Vérification offres
  const { data: offres, error: offresErr } = await sb
    .from('offres')
    .select('id, titre, statut_publication, active')
    .eq('recruteur_id', user.id)
    .eq('active', true)
    .limit(5)

  if (!offresErr && offres && offres.length > 0) {
    console.log(`\n📋 ${offres.length} offre(s) active(s) trouvée(s) (sur les premières vérifiées) :`)
    for (const o of offres) {
      console.log(`   • ${o.titre} [${o.statut_publication}]`)
    }
    console.log('\n→  Le two-step sur /offres et /offres/[id] les enrichira automatiquement')
    console.log('   avec entreprise_nom = "Meridian Studio".')
  } else {
    console.log('\n⚠  Aucune offre active trouvée pour ce recruteur.')
  }

  console.log('\n─────────────────────────────────────────────────────────')
  console.log('🖼  LOGO : pas de logo uploadé par le script.')
  console.log('   Option la plus simple pour la démo :')
  console.log('   Connecte-toi en tant que Paul sur /recruteur/entreprise,')
  console.log('   clique "Modifier" → "Choisir un logo" → upload un PNG/JPG.')
  console.log('   Alternative : mettre une URL publique directement en SQL :')
  console.log(`   UPDATE profils SET entreprise_logo_url = 'https://...'`)
  console.log(`   WHERE user_id = '${user.id}';`)
  console.log('─────────────────────────────────────────────────────────\n')

  await sb.auth.signOut()
}

main().catch(err => {
  console.error('❌  Erreur inattendue :', err)
  process.exit(1)
})
