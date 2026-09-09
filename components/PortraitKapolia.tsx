import React from 'react'
import { Document, Page, View, Text, Font, Svg, Path, Image } from '@react-pdf/renderer'
import { join } from 'path'

// ─── Polices embarquées ────────────────────────────────────────────────────────

const FONT_DIR = join(process.cwd(), 'public', 'fonts')

Font.register({ family: 'Inter', fonts: [
  { src: join(FONT_DIR, 'Inter-Regular.ttf'), fontWeight: 400 },
  { src: join(FONT_DIR, 'Inter-Medium.ttf'),  fontWeight: 500 },
  { src: join(FONT_DIR, 'Inter-Bold.ttf'),    fontWeight: 700 },
  { src: join(FONT_DIR, 'Inter-Italic.ttf'),  fontWeight: 400, fontStyle: 'italic' },
]})

Font.register({ family: 'Lora', fonts: [
  { src: join(FONT_DIR, 'Lora-Regular.ttf'),  fontWeight: 400 },
  { src: join(FONT_DIR, 'Lora-SemiBold.ttf'), fontWeight: 600 },
  { src: join(FONT_DIR, 'Lora-Bold.ttf'),     fontWeight: 700 },
]})

Font.registerHyphenationCallback(word => [word])

// ─── Typographie — constantes fixes (spec maquette) ───────────────────────────

const FS = {
  nom:       23,    // Lora 600
  intitule:  10,    // Inter 700
  contact:   8,     // Inter 400
  cardTitle: 11.5,  // Lora 600
  itemTitle: 12,    // Lora 600
  company:   9,     // Inter 700
  body:      8,     // Inter 400
  dates:     7.7,   // Inter 400
  italic:    7.2,   // Inter italic
  badge:     8,     // Inter 400/700
  footer:    7.4,   // Lora 400 / Inter 400
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type ProfilPDF = {
  prenom:               string
  nom:                  string
  domaine?:             string
  experience?:          string
  ville?:               string
  signature?:           string
  experiences?:         ExpPDF[]
  diplomes?:            DipPDF[]
  competences_acquises?: string[]
  langues?:             string[]
  projet_phare?:        string
  projet_titre?:        string
  valeur?:              string
  qualites?:            string[]
  passions?:            string[]
  type_poste?:          string[]
  disponibilite?:       string
  telephone?:           string | null
  avatar_url?:          string | null
  avatar_type?:         string | null
}

type ExpPDF = {
  poste:      string
  entreprise: string
  date_debut: string
  date_fin:   string
  en_poste:   boolean
  missions:   string
}

type DipPDF = {
  intitule: string
  ecole:    string
  annee:    string
  mention?: string
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const DISPO_LABELS: Record<string, string> = {
  maintenant:  'En recherche active',
  a_partir_de: 'Disponible à une date',
  en_poste:    "En poste, à l'écoute",
}

const BANDEAU_PY = 18   // padding vertical bandeau vert
const CARD_PAD_H = 12   // padding horizontal interne des cartes
const CARD_PAD_V = 9    // padding vertical de base — doit rester > ENTRY_GAP
const CARD_GAP   = 7.7  // écart de base entre cartes (maquette 9px×0.86)
const ENTRY_GAP  = 8    // écart fixe entre deux entrées d'une même carte (exp, diplôme)
const LINE_H     = 1.45 // interligne de base
const MARGIN_H   = 26   // marges latérales de page

// ─── Échelle unique — base aérée, réduite par facteur si débordement ──────────

export type ScaleCfg = {
  cardPadV:  number
  cardGap:   number
  lineH:     number
  companyMt: number  // marginTop entreprise sous intitulé de poste
  bulletMt:  number  // marginTop première puce sous entreprise
}

export const BASE_SCALE: ScaleCfg = {
  cardPadV:  CARD_PAD_V,
  cardGap:   CARD_GAP,
  lineH:     LINE_H,
  companyMt: 1,
  bulletMt:  5,
}

// Réduit toutes les grandeurs spatiales d'un facteur (0 < factor ≤ 1).
// lineH est réduit sur sa marge au-dessus de 1 pour ne jamais passer sous 1.
export function scaleDown(base: ScaleCfg, factor: number): ScaleCfg {
  return {
    cardPadV:  base.cardPadV  * factor,
    cardGap:   base.cardGap   * factor,
    lineH:     1 + (base.lineH - 1) * factor,
    companyMt: Math.max(0.5, base.companyMt * factor),
    bulletMt:  Math.max(1,   base.bulletMt  * factor),
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function trunc(s: string | undefined | null, max?: number): string {
  if (!s) return ''
  if (!max || s.length <= max) return s
  const cut       = s.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd() + '…'
}

function moisCourant(): string {
  return new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
}

function splitLines(text: string): string[] {
  return text.split('\n').map(l => l.trim()).filter(Boolean)
}

// ─── Sous-composants PDF ──────────────────────────────────────────────────────

function Card({ children, s }: { children: React.ReactNode; s: ScaleCfg }) {
  return (
    <View style={{
      backgroundColor: 'white',
      borderRadius: 5,
      borderWidth: 0.6,
      borderColor: '#EDE4D4',
      borderStyle: 'solid',
      paddingHorizontal: CARD_PAD_H,
      paddingVertical: s.cardPadV,
      marginBottom: s.cardGap,
    }}>
      {children}
    </View>
  )
}

// Filet sous le titre ; marginBottom = cardPadV pour symétriser haut et bas de carte
function CardTitle({ label, s }: { label: string; s: ScaleCfg }) {
  return (
    <View style={{ borderBottomWidth: 0.6, borderBottomColor: '#EDE4D4', borderBottomStyle: 'solid', paddingBottom: 5, marginBottom: s.cardPadV }}>
      <Text style={{ fontFamily: 'Lora', fontWeight: 600, fontSize: FS.cardTitle, color: '#2C4A3E' }}>
        {label}
      </Text>
    </View>
  )
}

// Rendu inline des langues — réutilisé dans la carte séparée et la carte fusionnée
function LangInlineText({ langs, lineH }: { langs: string[]; lineH: number }) {
  return (
    <Text style={{ fontSize: FS.body, lineHeight: lineH, color: '#22312B' }}>
      {langs.map((lang, i) => {
        const sep   = lang.indexOf(' — ')
        const name  = sep >= 0 ? lang.slice(0, sep).trim() : lang.trim()
        const level = sep >= 0 ? lang.slice(sep + 3).trim() : ''
        return (
          <Text key={i}>
            {i > 0 ? <Text>{' · '}</Text> : null}
            <Text style={{ fontWeight: 700, color: '#2C4A3E' }}>{name}</Text>
            {level ? <Text style={{ fontWeight: 400, color: '#22312B' }}>{' '}{level}</Text> : null}
          </Text>
        )
      })}
    </Text>
  )
}

// ─── Document principal ───────────────────────────────────────────────────────

type Props = {
  profil:         ProfilPDF
  email:          string
  title?:         string
  withPhoto?:     boolean
  avatarData?:    string
  scale?:         ScaleCfg
  forceTruncate?: boolean
  mergeMode?:     'none' | 'A'
  showEmail?:     boolean
  showPhone?:     boolean
}

export default function PortraitKapolia({ profil, email, title, withPhoto, avatarData, scale, forceTruncate = false, mergeMode = 'none', showEmail = true, showPhone = true }: Props) {
  const s = scale ?? BASE_SCALE

  const exps     = profil.experiences ?? []
  const dips     = profil.diplomes ?? []
  const comps    = profil.competences_acquises ?? []
  const langs    = profil.langues ?? []
  const qualites = profil.qualites ?? []
  const passions = profil.passions ?? []

  // Tailles adaptatives des intitulés — réduites quand il y a beaucoup d'entrées
  const expTitleSize = exps.length <= 2 ? 14 : exps.length === 3 ? 12.5 : 11.5
  const dipTitleSize = dips.length <= 1 ? 14 : 12

  // Intitulé : champ saisi dans la fenêtre d'export, sinon repli sur le domaine
  const displayTitle = title || profil.domaine || ''

  const dispoStr = profil.disponibilite ? (DISPO_LABELS[profil.disponibilite] ?? profil.disponibilite) : ''

  // Colonne droite du bandeau : "X ans · disponibilité"
  const rightLine2 = [profil.experience, dispoStr].filter(Boolean).join('  ·  ')

  // Troncature uniquement si débordement réel (second pass)
  const signatureTxt = trunc(profil.signature,   forceTruncate ? 400 : undefined)
  const projetTxt    = trunc(profil.projet_phare, forceTruncate ? 300 : undefined)

  const showPhoto = !!(withPhoto && avatarData)

  // TEMPORAIRE — liste des sections rendues. Pour en réactiver une, ajoutez son nom ici.
  const SECTIONS_ACTIVES = [
    'Présentation',
    'Expérience',
    'Formation',
    'Projet phare',
    'Compétences',
    'Qualités naturelles',
    // "Centres d'intérêt",
    // 'Langues',
    "Centres d'intérêt et langues",
  ]

  return (
    <Document>
      <Page
        size="A4"
        style={{ fontFamily: 'Inter', color: '#22312B', backgroundColor: '#F7F2EB', display: 'flex', flexDirection: 'column' }}
      >
        {/* ── Bandeau ─────────────────────────────────────────────────────── */}
        <View style={{ backgroundColor: '#2C4A3E', paddingHorizontal: 29, paddingVertical: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', minHeight: 64 }}>
            <View style={{ flex: 1, paddingRight: showPhoto ? 14 : 0 }}>

              {/* Nom : Lora 600, 23pt, #FFFFFF, lineHeight 1.05 */}
              <Text style={{ fontFamily: 'Lora', fontWeight: 700, fontSize: FS.nom, color: 'white', lineHeight: 1.05 }}>
                {profil.prenom} {profil.nom}
              </Text>

              {/* Intitulé : Inter 700, 10pt, #E8D5B7, marginTop 4pt */}
              {displayTitle ? (
                <Text style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 11.5, color: '#F2E4CC', marginTop: 4 }}>
                  {displayTitle}
                </Text>
              ) : null}

              {/* Contacts : marginTop 9pt, deux flex:1, ecart 22pt via paddingRight gauche */}
              <View style={{ flexDirection: 'row', marginTop: (showEmail && email) || (showPhone && profil.telephone) ? 9 : 0 }}>
                {/* Gauche : email · téléphone sur une ligne — Inter 700, 8.5pt, blanc */}
                <View style={{ flex: 1, paddingRight: 22 }}>
                  {((showEmail && email) || (showPhone && profil.telephone)) ? (
                    <Text style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 8.5, color: 'white' }}>
                      {[showEmail && email ? email : null, showPhone && profil.telephone ? profil.telephone : null].filter(Boolean).join(' · ')}
                    </Text>
                  ) : null}
                </View>
                {/* Droite : ville + expérience/dispo — Inter 500, 8.5pt, blanc */}
                <View style={{ flex: 1 }}>
                  {profil.ville ? (
                    <Text style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 8.5, color: 'white', marginBottom: 2.5 }}>{profil.ville}</Text>
                  ) : null}
                  {rightLine2 ? (
                    <Text style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 8.5, color: 'white' }}>{rightLine2}</Text>
                  ) : null}
                </View>
              </View>

            </View>
            {/* Photo — lisere dessiné par le fond sable du wrapper (react-pdf peint la bordure sous l'image) */}
            {showPhoto ? (
              <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#E8D5B7', flexShrink: 0, alignItems: 'center', justifyContent: 'center' }}>
                <Image
                  src={avatarData!}
                  style={{ width: 62, height: 62, borderRadius: 31 }}
                />
              </View>
            ) : null}
          </View>
        </View>

        {/* ── Découpe crème — viewBox 400×14 + preserveAspectRatio none ───── */}
        {/* Chemin crème concave : le vert reste visible au centre (arche), crème aux bords */}
        <View style={{ marginTop: -1 }}>
          <Svg width={595.28} height={14} viewBox="0 0 400 14" preserveAspectRatio="none">
            <Path d="M0,0 C110,15 290,15 400,0 L400,14 L0,14 Z" fill="#F7F2EB" />
          </Svg>
        </View>

        {/* ── Cartes ──────────────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: MARGIN_H, paddingTop: 2 }}>

          {/* Présentation */}
          {SECTIONS_ACTIVES.includes('Présentation') && signatureTxt ? (
            <Card s={s}>
              <Text style={{ fontSize: FS.body, color: '#3A4A43', lineHeight: 1.5 }}>
                {signatureTxt}
              </Text>
            </Card>
          ) : null}

          {/* Expérience professionnelle */}
          {SECTIONS_ACTIVES.includes('Expérience') && exps.length > 0 && (
            <Card s={s}>
              <CardTitle label="Expérience professionnelle" s={s} />
              {exps.map((exp, i) => {
                const datesStr = exp.en_poste
                  ? `depuis ${exp.date_debut}`.trim()
                  : [exp.date_debut, exp.date_fin].filter(Boolean).join(' - ')
                const lines = splitLines(exp.missions ?? '')
                return (
                  <View key={i} style={{ marginBottom: i < exps.length - 1 ? ENTRY_GAP : 0 }} wrap={false}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Text style={{ fontFamily: 'Lora', fontWeight: 600, fontSize: expTitleSize, color: '#2C4A3E', flex: 1, paddingRight: 8 }}>
                        {exp.poste || ''}
                      </Text>
                      {datesStr ? (
                        <Text style={{ fontSize: FS.dates, color: '#6B7A73', flexShrink: 0, marginTop: 2 }}>
                          {datesStr}
                        </Text>
                      ) : null}
                    </View>
                    {exp.entreprise ? (
                      <Text style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: FS.company, color: '#C4673A', marginTop: s.companyMt }}>
                        {exp.entreprise}
                      </Text>
                    ) : null}
                    {lines.map((line, j) => (
                      <View key={j} style={{ flexDirection: 'row', marginTop: j === 0 ? s.bulletMt : 1 }}>
                        <View style={{ width: 8 }}>
                          <Text style={{ fontSize: FS.body, color: '#3A4A43' }}>{'•'}</Text>
                        </View>
                        <Text style={{ fontSize: FS.body, color: '#3A4A43', lineHeight: 1.5, flex: 1 }}>{line}</Text>
                      </View>
                    ))}
                  </View>
                )
              })}
            </Card>
          )}

          {/* Formation */}
          {SECTIONS_ACTIVES.includes('Formation') && dips.length > 0 && (
            <Card s={s}>
              <CardTitle label="Formation" s={s} />
              {dips.map((d, i) => (
                <View key={i} style={{ marginBottom: i < dips.length - 1 ? (dips.length > 1 ? 5 : ENTRY_GAP) : 0 }} wrap={false}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Text style={{ fontFamily: 'Lora', fontWeight: 600, fontSize: expTitleSize, color: '#2C4A3E', flex: 1, paddingRight: 8 }}>
                      {d.intitule || ''}
                      {d.ecole ? (
                        <Text style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: FS.company, color: '#C4673A' }}>
                          {' · '}{d.ecole}
                        </Text>
                      ) : null}
                    </Text>
                    {d.annee ? (
                      <Text style={{ fontSize: FS.dates, color: '#6B7A73', flexShrink: 0, marginTop: 2 }}>
                        {d.annee}
                      </Text>
                    ) : null}
                  </View>
                  {d.mention ? (
                    <Text style={{ fontSize: FS.body, color: '#3A4A43', lineHeight: 1.5, marginTop: 4 }}>
                      {d.mention}
                    </Text>
                  ) : null}
                </View>
              ))}
            </Card>
          )}

          {/* Projet phare — projet_phare en Lora 600 14pt, sans doublon */}
          {SECTIONS_ACTIVES.includes('Projet phare') && profil.projet_titre ? (
            <Card s={s}>
              <CardTitle label="Projet phare" s={s} />
              <Text style={{ fontFamily: 'Lora', fontWeight: 600, fontSize: expTitleSize, color: '#2C4A3E', lineHeight: s.lineH }}>
                {profil.projet_titre}
              </Text>
              <Text style={{ fontFamily: 'Inter', fontStyle: 'italic', fontSize: FS.italic, color: '#6B7A73', marginTop: 4, lineHeight: 1.45 }}>
                Le détail de ce projet et le profil complet sont consultables sur Kapolia.
              </Text>
            </Card>
          ) : null}

          {/* Compétences — toujours dans sa propre carte, avant les qualités */}
          {SECTIONS_ACTIVES.includes('Compétences') && comps.length > 0 && (
            <Card s={s}>
              <CardTitle label="Compétences" s={s} />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {comps.map((c, i) => (
                  <View key={i} style={{ backgroundColor: '#F7F2EB', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 1.7, marginRight: 3, marginBottom: 4 }}>
                    <Text style={{ fontSize: FS.badge, color: '#22312B' }}>{c}</Text>
                  </View>
                ))}
              </View>
            </Card>
          )}

          {/* Qualités naturelles — toujours séparée */}
          {SECTIONS_ACTIVES.includes('Qualités naturelles') && qualites.length > 0 && (
            <Card s={s}>
              <CardTitle label="Qualités naturelles" s={s} />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {qualites.map((q, i) => (
                  <View key={i} style={{ backgroundColor: '#FBF0E9', borderRadius: 8, borderWidth: 1, borderColor: '#C4673A', borderStyle: 'solid', paddingHorizontal: 9, paddingVertical: 1.5, marginRight: 3.5, marginBottom: 4 }}>
                    <Text style={{ fontSize: FS.badge, color: '#C4673A', fontWeight: 700 }}>{q}</Text>
                  </View>
                ))}
              </View>
            </Card>
          )}

          {/* Centres d'intérêt — carte séparée en mode none uniquement */}
          {SECTIONS_ACTIVES.includes("Centres d'intérêt") && passions.length > 0 && mergeMode === 'none' && (
            <Card s={s}>
              <CardTitle label="Centres d'intérêt" s={s} />
              <Text style={{ fontSize: FS.body, lineHeight: s.lineH, color: '#3A4A43' }}>
                {passions.join('  ·  ')}
              </Text>
            </Card>
          )}

          {/* Langues — carte séparée en mode none uniquement */}
          {SECTIONS_ACTIVES.includes('Langues') && langs.length > 0 && mergeMode === 'none' && (
            <Card s={s}>
              <CardTitle label="Langues" s={s} />
              <LangInlineText langs={langs} lineH={s.lineH} />
            </Card>
          )}

          {/* ── Carte fusionnée (mode A) : Centres d'intérêt + Langues ──────────── */}
          {SECTIONS_ACTIVES.includes("Centres d'intérêt et langues") && mergeMode === 'A' && (
            <Card s={s}>
              <CardTitle label="Centres d'intérêt et langues" s={s} />
              <View>
                {passions.length > 0 && (
                  <Text style={{ fontSize: FS.body, lineHeight: s.lineH, color: '#3A4A43' }}>
                    {passions.join('  ·  ')}
                  </Text>
                )}
                {langs.length > 0 && (
                  <View style={{ marginTop: passions.length > 0 ? 3 : 0 }}>
                    <LangInlineText langs={langs} lineH={s.lineH} />
                  </View>
                )}
              </View>
            </Card>
          )}

        </View>

        {/* ── Pied de page ────────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: MARGIN_H, paddingBottom: 16, paddingTop: 6, flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ fontFamily: 'Lora', fontSize: FS.footer, color: '#2C4A3E' }}>
            Portrait Kapolia
          </Text>
          <Text style={{ fontSize: FS.footer, color: '#6B7A73' }}>
            {moisCourant()}
          </Text>
        </View>
      </Page>
    </Document>
  )
}

// ─── Fabrique sans JSX — pour route.ts ────────────────────────────────────────

type MakeDocumentProps = {
  profil:         ProfilPDF
  email:          string
  title?:         string
  withPhoto?:     boolean
  avatarData?:    string
  scale?:         ScaleCfg
  forceTruncate?: boolean
  mergeMode?:     'none' | 'A'
  showEmail?:     boolean
  showPhone?:     boolean
}

export function makeDocument(props: MakeDocumentProps): React.ReactElement<any> {
  return React.createElement(PortraitKapolia, props) as React.ReactElement<any>
}
