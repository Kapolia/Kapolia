export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email'

const SITE = 'https://kapolia.com'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

export async function POST(req: NextRequest) {
  let jeton: string
  try {
    const body = await req.json()
    jeton = body?.jeton
  } catch {
    return NextResponse.json({ error: 'Corps invalide' }, { status: 400 })
  }

  if (!jeton || typeof jeton !== 'string' || jeton.length > 200) {
    return NextResponse.json({ error: 'Jeton invalide' }, { status: 400 })
  }

  const admin = adminClient()

  // 1. Vérifier que l'invitation existe et a bien été utilisée
  const { data: inv, error: invErr } = await admin
    .from('invitations_proches')
    .select('id, candidat_id, used_at')
    .eq('jeton', jeton)
    .single()

  if (invErr || !inv?.used_at) {
    // Réponse opaque : ne pas distinguer jeton inexistant et jeton non utilisé
    console.info('[notif reponse-proche] ignoré', { raison: invErr ? 'introuvable' : 'non utilisé', jeton: jeton.slice(0, 8) })
    return NextResponse.json({ ok: true })
  }

  // 2. Marque atomique — garantit qu'un seul appel déclenche l'envoi
  const { count } = await admin
    .from('reponses_proches')
    .update({ email_notif_envoyee: true }, { count: 'exact' })
    .eq('invitation_id', inv.id)
    .eq('email_notif_envoyee', false)

  if ((count ?? 0) === 0) {
    // Déjà envoyé ou réponse non encore enregistrée
    return NextResponse.json({ ok: true })
  }

  // 3. Récupérer le prénom du proche pour le sujet (avant after(), via closure)
  const { data: rep } = await admin
    .from('reponses_proches')
    .select('prenom_proche')
    .eq('invitation_id', inv.id)
    .single()
  const prenomProche = (rep as { prenom_proche?: string } | null)?.prenom_proche ?? 'Votre proche'

  // 4. Envoi après la réponse HTTP — Vercel maintient la fonction en vie via waitUntil
  after(async () => {
    const [{ data: authUser, error: authErr }, { data: profil }] = await Promise.all([
      admin.auth.admin.getUserById(inv.candidat_id),
      admin.from('profils').select('email_notifications, notif_proche, prenom').eq('user_id', inv.candidat_id).single(),
    ])

    if (authErr || !authUser?.user?.email) {
      console.error('[notif reponse-proche] getUserById', authErr?.message, { candidatId: inv.candidat_id })
      return
    }
    if (!profil?.email_notifications) return
    if (profil?.notif_proche === false) return

    const prenomCand = (profil as { prenom?: string } | null)?.prenom ?? ''
    const salutation = prenomCand ? `Bonjour ${prenomCand},` : 'Bonjour,'

    const result = await sendEmail({
      to:      { email: authUser.user.email },
      subject: `${prenomProche} a décrit vos qualités`,
      html:    `<p>${salutation}</p><p>${prenomProche} vient de décrire vos qualités. Ses mots vous attendent sur votre profil Kapolia.</p><p>Connectez-vous pour les découvrir et choisir lesquels afficher aux recruteurs.</p><p><a href="${SITE}/dashboard">Voir mon profil →</a></p><p style="margin-top:32px;font-size:12px;color:#888;">Pour ne plus recevoir ces e-mails : <a href="${SITE}/parametres#notifications" style="color:#888;">${SITE}/parametres#notifications</a></p>`,
      text:    `${salutation}\n\n${prenomProche} vient de décrire vos qualités. Ses mots vous attendent sur votre profil Kapolia.\n\nConnectez-vous pour les découvrir et choisir lesquels afficher aux recruteurs.\n\n${SITE}/dashboard\n\nPour ne plus recevoir ces e-mails : ${SITE}/parametres#notifications`,
    })

    if (!result.ok) console.error('[notif reponse-proche] sendEmail', result.error, { candidatId: inv.candidat_id })
  })

  return NextResponse.json({ ok: true })
}
