import type { Metadata } from 'next'
import Link from 'next/link'
import LogoKapolia from '@/components/LogoKapolia'

export const metadata: Metadata = {
  title: 'Mentions légales — Kapolia',
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

export default function MentionsLegales() {
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
          margin:     '0 0 56px',
          lineHeight: 1.2,
        }}>
          Mentions légales
        </h1>

        <Section titre="Éditeur du site">
          <P>
            Le site kapolia.com est édité par Charley Foucher, personne physique,
            demeurant 7 Allée des Licornes, 72100 Le Mans, France.
          </P>
          <P>Contact&nbsp;: contact@kapolia.com</P>
          <P>Directeur de la publication&nbsp;: Charley Foucher</P>
        </Section>

        <Section titre="Statut">
          <P>
            Kapolia est un projet en cours de développement, édité à titre
            personnel. Aucune activité commerciale n'est exercée à ce jour et
            aucun service payant n'est proposé.
          </P>
        </Section>

        <Section titre="Hébergement">
          <P>
            Le site est hébergé par Vercel Inc., 340 S Lemon Ave #4133, Walnut,
            CA 91789, États-Unis. Site&nbsp;: vercel.com
          </P>
        </Section>

        <Section titre="Propriété intellectuelle">
          <P>
            L'ensemble des contenus présents sur ce site, incluant les textes, la
            charte graphique, le nom Kapolia et son identité visuelle, est protégé
            par le droit de la propriété intellectuelle. Toute reproduction sans
            autorisation préalable est interdite.
          </P>
        </Section>

        <Section titre="Responsabilité">
          <P>
            Le site présente un service en cours de développement. Les informations
            qui y figurent sont données à titre indicatif et peuvent évoluer sans préavis.
          </P>
        </Section>

        <Section titre="Droit applicable">
          <P>
            Les présentes mentions sont soumises au droit français.
          </P>
        </Section>

      </div>
    </main>
  )
}
