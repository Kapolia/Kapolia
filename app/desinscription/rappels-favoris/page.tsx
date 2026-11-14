import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { verifierJeton } from '@/lib/rappels-favoris'
import { FONT_SANS } from '@/lib/typography'
import { C } from '@/lib/colors'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  backgroundColor: C.bg,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '24px 16px',
}

const cardStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 420,
  backgroundColor: C.white,
  border: `1px solid ${C.sable}`,
  borderRadius: 16,
  padding: '36px 32px',
}

const logoStyle: React.CSSProperties = {
  fontFamily: FONT_SANS,
  fontSize: 20,
  fontWeight: 700,
  color: C.vert,
  display: 'block',
  marginBottom: 28,
}

const lienStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: C.orangeTexte,
  textDecoration: 'underline',
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ t?: string; done?: string; erreur?: string }>
}) {
  const params = await searchParams

  if (params.done === '1') {
    return (
      <main style={pageStyle}>
        <div style={cardStyle}>
          <span style={logoStyle}>Kapolia</span>
          <h1 style={{
            fontFamily: FONT_SANS, letterSpacing: '-0.01em',
            fontSize: 22, fontWeight: 700, color: C.dark, margin: '0 0 12px',
          }}>
            Rappels de favoris désactivés
          </h1>
          <p style={{ fontSize: 14, color: C.grey, lineHeight: 1.65, margin: '0 0 24px' }}>
            Vous ne recevrez plus de rappel pour les offres que vous mettez en favori. Les autres e-mails de Kapolia ne changent pas.
          </p>
          <Link href="/parametres" style={lienStyle}>
            Réactiver dans mes paramètres
          </Link>
        </div>
      </main>
    )
  }

  const jeton = params.t ?? ''
  const userId = verifierJeton(jeton)

  if (!userId) {
    return (
      <main style={pageStyle}>
        <div style={cardStyle}>
          <span style={logoStyle}>Kapolia</span>
          <p style={{ fontSize: 14, color: C.grey, lineHeight: 1.65, margin: '0 0 20px' }}>
            Ce lien n&#39;est plus valable. Vous pouvez gérer vos e-mails dans vos paramètres.
          </p>
          <Link href="/parametres" style={lienStyle}>
            Mes paramètres
          </Link>
        </div>
      </main>
    )
  }

  const aErreur = params.erreur === '1'

  async function desactiver(formData: FormData) {
    'use server'
    const t = formData.get('t') as string
    const uid = verifierJeton(t)
    if (!uid) {
      redirect('/desinscription/rappels-favoris')
    }
    const admin = adminClient()
    const { error } = await admin.from('profils').update({ rappels_favoris: false }).eq('user_id', uid)
    if (error) {
      console.error('[desinscription] update failed', { userId: uid, code: error.code, message: error.message })
      redirect(`/desinscription/rappels-favoris?t=${encodeURIComponent(t)}&erreur=1`)
    }
    redirect('/desinscription/rappels-favoris?done=1')
  }

  return (
    <main style={pageStyle}>
      <div style={cardStyle}>
        <span style={logoStyle}>Kapolia</span>
        <h1 style={{
          fontFamily: FONT_SANS, letterSpacing: '-0.01em',
          fontSize: 22, fontWeight: 700, color: C.dark, margin: '0 0 12px',
        }}>
          Désactiver les rappels de favoris
        </h1>
        <p style={{ fontSize: 14, color: C.grey, lineHeight: 1.65, margin: '0 0 24px' }}>
          Vous ne recevrez plus de rappel pour les offres que vous mettez en favori.
        </p>
        <form action={desactiver}>
          <input type="hidden" name="t" value={jeton} />
          <button type="submit" style={{
            backgroundColor: C.terracotta, color: C.white, border: 'none',
            borderRadius: 10, padding: '12px 24px', fontSize: 14, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>
            Confirmer
          </button>
        </form>
        {aErreur && (
          <p style={{ fontSize: 13, color: C.erreur, margin: '16px 0 0', lineHeight: 1.5 }}>
            La désactivation n&#39;a pas fonctionné. Réessayez ou gérez vos e-mails dans{' '}
            <Link href="/parametres" style={{ color: C.erreur, textDecoration: 'underline' }}>
              vos paramètres
            </Link>.
          </p>
        )}
      </div>
    </main>
  )
}
