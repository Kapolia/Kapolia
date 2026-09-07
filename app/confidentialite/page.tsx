import type { Metadata } from 'next'
import Link from 'next/link'
import LogoKapolia from '@/components/LogoKapolia'

export const metadata: Metadata = {
  title: 'Politique de confidentialité — Kapolia',
}

const LORA  = 'Lora, Georgia, serif'
const INTER = 'Inter, system-ui, sans-serif'

const C = {
  vert:    '#2C4A3E',
  sable:   '#E8D5B7',
  creme:   '#F7F2EB',
  texte:   '#22312B',
  gris:    '#6B7280',
  bordure: '#E2D9CC',
}

function Section({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: '48px' }}>
      <h2 style={{
        fontFamily: LORA,
        fontSize:   '20px',
        fontWeight: 600,
        color:      C.vert,
        margin:     '0 0 16px',
        lineHeight: 1.3,
      }}>
        {titre}
      </h2>
      {children}
    </section>
  )
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontFamily: INTER,
      fontSize:   '16px',
      color:      C.texte,
      lineHeight: 1.75,
      margin:     '0 0 10px',
    }}>
      {children}
    </p>
  )
}

export default function Confidentialite() {
  return (
    <main style={{ backgroundColor: C.creme, minHeight: '100vh', padding: '0 0 96px' }}>

      {/* Barre supérieure */}
      <div style={{ backgroundColor: C.vert }}>
        <div style={{
          maxWidth: '1120px', margin: '0 auto', padding: '14px 48px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <Link href="/" style={{ textDecoration: 'none' }}>
            <LogoKapolia variante="contour" taille={28} />
          </Link>
          <span style={{ fontFamily: INTER, fontSize: '13px', color: C.sable, letterSpacing: '0.02em' }}>
            Bientôt disponible
          </span>
        </div>
      </div>

      {/* Retour */}
      <div style={{ borderBottom: `1px solid ${C.bordure}`, padding: '20px 0' }}>
        <div style={{ maxWidth: '720px', margin: '0 auto', padding: '0 32px' }}>
          <Link
            href="/"
            style={{
              fontFamily:     INTER,
              fontSize:       '14px',
              color:          C.vert,
              textDecoration: 'none',
              fontWeight:     500,
            }}
          >
            ← Retour
          </Link>
        </div>
      </div>

      {/* Contenu */}
      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '64px 32px 0' }}>

        <h1 style={{
          fontFamily: LORA,
          fontSize:   'clamp(28px, 4vw, 40px)',
          fontWeight: 700,
          color:      C.vert,
          lineHeight: 1.2,
          margin:     '0 0 56px',
        }}>
          Politique de confidentialité
        </h1>

        <Section titre="Responsable du traitement">
          <P>
            Charley Foucher, joignable à contact@kapolia.com.
          </P>
        </Section>

        <Section titre="Données collectées">
          <P>
            Ce site collecte uniquement votre adresse électronique et le type de
            compte que vous indiquez, candidat ou recruteur, lorsque vous vous
            inscrivez à la liste d'attente. La date de votre consentement est
            également enregistrée.
          </P>
        </Section>

        <Section titre="Finalité">
          <P>
            Ces données servent uniquement à vous prévenir de l'ouverture de
            Kapolia. Elles ne sont utilisées à aucune autre fin, ne sont ni
            vendues, ni louées, ni transmises à des tiers à des fins commerciales.
          </P>
        </Section>

        <Section titre="Base légale">
          <P>
            Le traitement repose sur votre consentement, recueilli au moment de
            l'inscription.
          </P>
        </Section>

        <Section titre="Durée de conservation">
          <P>
            Vos données sont conservées jusqu'à l'ouverture du service, puis six
            mois au maximum après celle-ci. Elles sont ensuite supprimées.
          </P>
        </Section>

        <Section titre="Hébergement des données">
          <P>
            Les données sont hébergées par Supabase, au sein de l'Union européenne.
          </P>
        </Section>

        <Section titre="Vos droits">
          <P>
            Conformément au règlement général sur la protection des données, vous
            disposez d'un droit d'accès, de rectification, d'effacement,
            d'opposition et de portabilité. Pour les exercer, écrivez à contact@kapolia.com.
            Vous pouvez également introduire une réclamation auprès de la CNIL.
          </P>
        </Section>

        <Section titre="Désinscription">
          <P>
            Vous pouvez demander à tout moment le retrait de votre adresse en
            écrivant à contact@kapolia.com.
          </P>
        </Section>

        <Section titre="Cookies">
          <P>
            Ce site ne dépose aucun cookie de mesure d'audience ni de publicité.
            Seuls les cookies techniques nécessaires à son fonctionnement sont
            utilisés.
          </P>
        </Section>

      </div>
    </main>
  )
}
