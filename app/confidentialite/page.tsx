import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Politique de confidentialité — Kapolia',
}

const LORA  = 'Lora, Georgia, serif'
const INTER = 'Inter, system-ui, sans-serif'

const C = {
  vert:    '#2C4A3E',
  creme:   '#F7F2EB',
  texte:   '#22312B',
  gris:    '#6B7280',
  sable:   '#E8D5B7',
  bordure: '#E2D9CC',
}

function Section({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: '48px' }}>
      <h2 style={{
        fontFamily:   LORA,
        fontSize:     '20px',
        fontWeight:   600,
        color:        C.vert,
        margin:       '0 0 16px',
        lineHeight:   1.3,
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
      fontFamily:  INTER,
      fontSize:    '16px',
      color:       C.texte,
      lineHeight:  1.75,
      margin:      '0 0 10px',
    }}>
      {children}
    </p>
  )
}

export default function Confidentialite() {
  return (
    <main style={{ backgroundColor: C.creme, minHeight: '100vh', padding: '0 0 96px' }}>

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
          fontFamily:   LORA,
          fontSize:     'clamp(28px, 4vw, 40px)',
          fontWeight:   700,
          color:        C.vert,
          lineHeight:   1.2,
          margin:       '0 0 56px',
        }}>
          Politique de confidentialité
        </h1>

        <Section titre="Responsable du traitement">
          <P>
            Charley Foucher, joignable a contact@kapolia.com.
          </P>
        </Section>

        <Section titre="Donnees collectees">
          <P>
            Ce site collecte uniquement votre adresse electronique et le type de
            compte que vous indiquez, candidat ou recruteur, lorsque vous vous
            inscrivez a la liste d'attente. La date de votre consentement est
            egalement enregistree.
          </P>
        </Section>

        <Section titre="Finalite">
          <P>
            Ces donnees servent uniquement a vous prevenir de l'ouverture de
            Kapolia. Elles ne sont utilisees a aucune autre fin, ne sont ni
            vendues, ni louees, ni transmises a des tiers a des fins commerciales.
          </P>
        </Section>

        <Section titre="Base legale">
          <P>
            Le traitement repose sur votre consentement, recueilli au moment de
            l'inscription.
          </P>
        </Section>

        <Section titre="Duree de conservation">
          <P>
            Vos donnees sont conservees jusqu'a l'ouverture du service, puis six
            mois au maximum apres celle-ci. Elles sont ensuite supprimees.
          </P>
        </Section>

        <Section titre="Hebergement des donnees">
          <P>
            Les donnees sont hebergees par Supabase, au sein de l'Union europeenne.
          </P>
        </Section>

        <Section titre="Vos droits">
          <P>
            Conformement au reglement general sur la protection des donnees, vous
            disposez d'un droit d'acces, de rectification, d'effacement,
            d'opposition et de portabilite. Pour les exercer, ecrivez a contact@kapolia.com. Vous pouvez egalement introduire une reclamation
            aupres de la CNIL.
          </P>
        </Section>

        <Section titre="Desinscription">
          <P>
            Vous pouvez demander a tout moment le retrait de votre adresse en
            ecrivant a contact@kapolia.com.
          </P>
        </Section>

        <Section titre="Cookies">
          <P>
            Ce site ne depose aucun cookie de mesure d'audience ni de publicite.
            Seuls les cookies techniques necessaires a son fonctionnement sont
            utilises.
          </P>
        </Section>

      </div>
    </main>
  )
}
