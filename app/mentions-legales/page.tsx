import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Mentions légales — Kapolia',
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

export default function MentionsLegales() {
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
          margin:       '0 0 56px',
          lineHeight:   1.2,
        }}>
          Mentions légales
        </h1>

        <Section titre="Editeur du site">
          <P>
            Le site kapolia.com est edite par Charley Foucher, personne physique,
            demeurant 7 Allee des Licornes, 72100 Le Mans, France.
          </P>
          <P>Contact : contact@kapolia.com</P>
          <P>Directeur de la publication : Charley Foucher</P>
        </Section>

        <Section titre="Statut">
          <P>
            Kapolia est un projet en cours de developpement, edite a titre
            personnel. Aucune activite commerciale n'est exercee a ce jour et
            aucun service payant n'est propose.
          </P>
        </Section>

        <Section titre="Hebergement">
          <P>
            Le site est heberge par Vercel Inc., 340 S Lemon Ave #4133, Walnut,
            CA 91789, Etats-Unis. Site : vercel.com
          </P>
        </Section>

        <Section titre="Propriete intellectuelle">
          <P>
            L'ensemble des contenus presents sur ce site, incluant les textes, la
            charte graphique, le nom Kapolia et son identite visuelle, est protege
            par le droit de la propriete intellectuelle. Toute reproduction sans
            autorisation prealable est interdite.
          </P>
        </Section>

        <Section titre="Responsabilite">
          <P>
            Le site presente un service en cours de developpement. Les informations
            qui y figurent sont donnees a titre indicatif et peuvent evoluer sans preavis.
          </P>
        </Section>

        <Section titre="Droit applicable">
          <P>
            Les presentes mentions sont soumises au droit francais.
          </P>
        </Section>

      </div>
    </main>
  )
}
