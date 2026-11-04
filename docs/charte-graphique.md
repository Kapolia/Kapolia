# Charte graphique Kapolia

Source de vérité : `lib/colors.ts`. Ne jamais écrire de valeur hexadécimale en dur dans les composants.

---

## Palette

| Token | Valeur | Usage |
|---|---|---|
| `C.vert` | `#24453A` | Couleur marque principale, fonds sidebar candidat, titres |
| `C.orange` | `#C2611F` | Bouton principal, entrée active, badges, logo |
| `C.orangeTexte` | `#A9541A` | Orange en texte (liens, « Voir tout ») |
| `C.orangeDoux` | `rgba(194, 97, 31, 0.2)` | Fond de l'entrée active |
| `C.terracotta` | `#C2611F` | Alias historique de `C.orange` |
| `C.bg` | `#F6F7F5` | Fond général des pages (gris-vert froid) |
| `C.creme` | `#F7F2EB` | **Landing uniquement** — zones chaudes mises en avant |
| `C.white` | `#FFFFFF` | Fond de carte, surfaces blanches |
| `C.chip` | `#F0F2F0` | Pastilles neutres |
| `C.salaire` | `#E6EFE9` | Pastilles salaire / mises en avant vertes |
| `C.sable` | `#E5E8E5` | Bordures (tous composants) |
| `C.dark` | `#15201B` | Texte principal |
| `C.grey` | `#646D67` | Texte secondaire, métadonnées |
| `C.chipTexte` | `#3B4A42` | Texte dans les pastilles |
| `C.surVert` | `rgba(255, 255, 255, 0.72)` | Texte sur fond vert (sidebar) |
| `C.succes` | `#3E8E5E` | État accepté / succès |
| `C.attente` | `#C88A2A` | État en cours / en attente |
| `C.erreur` | `#C0392B` | État refusé / erreur |

### Couleurs hors charte (constantes locales autorisées)

Ces couleurs n'ont pas de token global ; chaque fichier qui en a besoin les déclare localement :

| Valeur | Usage |
|---|---|
| `#D0D0D0` ou `#C8C8C8` | Gris clair (éléments désactivés, pistes de score) — `lightGrey` local |
| `#2563EB` | Bleu (statut "Vue" des candidatures) — traitement futur |
| `#FDECEA` | Fond rouge clair (état refusé) — `redBg` local |
| `#AAAAAA` | Gris placeholder très clair (compteurs) |

---

## Typographie

| Rôle | Famille | Graisse | Style | Lettre-espacement |
|---|---|---|---|---|
| Titres (h1, h2, h3), logo "Kapolia" | Lora (`FONT_SERIF`) | **600** | normal | `-0.005em` |
| Citations (blockquote, extraits en italique) | Lora (`FONT_SERIF`) | 400 | **italic** | `-0.005em` |
| Corps de texte, interface, formulaires | Source Sans 3 (`FONT_SANS`) | 400–700 | normal ou italic | — |

Règles :
- Lora 600 : tous les titres sans exception. La règle CSS `h1, h2, h3 { font-weight: 600 }` dans `@layer base` s'applique comme filet de sécurité.
- Lora 400 italic : réservée aux citations. Jamais en capitales.
- Source Sans 3 : police variable (un fichier woff2 normal + un fichier italic couvrent 400–700 chacun).
- Fichiers woff2 dans `public/fonts/` (voir `SOURCES.md`). Pas de préchargement dans `layout.tsx` pour les variantes 400 et italic — uniquement les fichiers à usage systématique méritent un `<link rel="preload">`.
- Polices PDF (react-pdf) : fichiers `.ttf` séparés — ne pas toucher.

---

## Arrondis

| Contexte | Valeur |
|---|---|
| Cartes de premier niveau | `CARD_RADIUS = 12` px |
| Boutons | `9` px |
| Pastilles / badges en gélule | `9999` px (`borderRadius: 9999`) |

---

## Ombre

```ts
CARD_SHADOW = '0 1px 2px rgba(27, 48, 38, .06), 0 6px 16px rgba(27, 48, 38, .07)'
```

Ombre teintée vert deux couches. Réservée aux cartes de premier niveau (offres, profils, etc.).

---

## Exception landing

`app/page.tsx` conserve sa propre palette locale (sable `#E8D5B7`, creme `#F7F2EB`, texte `#22312B`, etc.). C'est une page éditoriale — ne pas l'uniformiser avec le reste de l'interface. Seuls `C.vert` et `C.orange` doivent correspondre aux valeurs globales.
