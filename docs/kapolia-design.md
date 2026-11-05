# Kapolia — design et comportements de référence

Toutes les valeurs de couleur viennent de `lib/colors.ts` via `C`. Ne jamais écrire de hex en dur dans les composants.

---

## Page des offres (`app/offres/page.tsx`)

### Barre de filtres

Deux lignes dans l'en-tête vert sombre.

**Ligne 1** — recherche textuelle (`q`) + saisie de lieu avec rayon (`l`, `r`, `lat`, `lng`).

**Ligne 2** — pills horizontales à défilement, dans cet ordre :

| Ordre | Filtre | URL param | Composant |
|---|---|---|---|
| 1 | Correspondance (score min) | `sm` | `CorrespondancePill` |
| 2 | Contrat + durée CDD | `c`, `dc` | `ContratPillDropdown` |
| 3 | Domaine | `d` (virgule) | `MultiPillDropdown` |
| 4 | Salaire minimum | `s` | `SalairePillDropdown` |
| 5 | Expérience | `e` | `PillDropdown` |
| 6 | Langues | `lang` (virgule) | `LangPillDropdown` |
| 7 | Date de publication | `dp` | `PillDropdown` |
| 8 | Autres (panneau) | voir ci-dessous | `AutresPillButton` |

Bouton **Tout effacer** apparaît à droite des pills quand au moins un filtre est actif.

### Menu Autres

Panneau fixe de 520 px positionné sous le bouton, four groupes dans l'ordre :

**Ligne 1 — 2 colonnes (grille 1fr 1fr, gap 20 px) :**

- Colonne gauche — **Télétravail** : labels courts de `TELETRAVAIL_OPTIONS` (`lib/referentiels.ts`) ; filtre `mode` (`m`) ; OU entre les cases.
- Colonne droite — **Prise de poste** : Immédiate, Dans le mois, Dans 3 mois ; filtre `prise_de_poste` (`pp`) ; mono-sélection.

**Pleine largeur :**

- **Horaires de travail** (`h`) : `TEMPS_TRAVAIL` + `HORAIRES` de `lib/referentiels.ts` — un seul groupe visuel, deux sous-groupes logiques.
- **Permis** (`pe`) : « Sans permis requis » + `PERMIS` de `lib/referentiels.ts`.
- **Autres** (`a`) : Statut cadre, Logement fourni, Repas fournis, Poste ouvert aux personnes en situation de handicap.

Le badge de comptage = `mode.length + (priseDePoste ? 1 : 0) + horaires.length + permis.length + autres.length`.

Bouton **Tout effacer** en pied de panneau : remet tous les 5 champs de ce menu à vide.

### Roulette (effet de profondeur sur le défilement)

Quand la colonne gauche de la liste défile, chaque carte partiellement hors viewport reçoit une transformation 3D calculée par RAF (`scheduleRoulette` / `applyRoulette`) :

```
perspective(900px) rotateX(sens × t × 38deg) scale(1 − 0.08 × t)
opacity = 1 − 0.55 × t
```

- `t` = proportion de la carte masquée (0–1).
- `sens` = +1 si elle disparaît en haut, -1 en bas.
- `transformOrigin` : `50% 100%` (haut) ou `50% 0%` (bas).
- Désactivé si `prefers-reduced-motion: reduce` ou si la liste tient entièrement dans la fenêtre.

### Carte sélectionnée (mode liste + panneau)

La carte active reçoit :

- `scale: '1.035'` (agrandissement 3,5 %)
- `zIndex: 2`
- Fond orange à 7 % d'opacité
- Bordure gauche 3 px orange (`C.terracotta`)

La sélection se synchronise dans l'URL via le param `offre`.

### Navigation au clavier

Écouteur `keydown` sur `document` : `ArrowDown` / `ArrowUp` avancent ou reculent d'un cran dans la liste filtrée. L'élément sélectionné est scrollé en vue dans la colonne gauche.

### État aucune offre avec suggestions (`EmptyStateFilters`)

Affiché uniquement quand des filtres sont actifs et que la liste est vide.

- Titre : **« Aucune offre ne correspond à tous vos critères »**
- Si des suggestions existent : *« Un seul critère bloque peut-être la recherche : »*
- Chaque suggestion est un bouton **« Retirer "X" »** + compteur d'offres débloquées. Calculé par `tryRemove` : simulation de la suppression de ce seul critère sur `applyFiltersOnly`.
- Couverture de `tryRemove` : domaine, contrat, lieu/coords, expérience, salaire, date de publication, prise de poste, langues, horaires, permis, autres.
- Bouton **Tout effacer** toujours présent en bas.

---

## Carte d'offre (`components/OffreCard.tsx`)

### Deux modes

- **Mode pleine largeur** : rendu par défaut, padding 16/22 px.
- **Mode compact (split view)** : activé dès que la prop `onSelect` est fournie ; padding réduit 14/16 px.

### Score

Affiché en pied de carte si `offre.score != null` :

- Ligne 12 px : description du score à gauche (`C.grey`) + valeur en pourcentage à droite (`C.vert`, gras).
- Barre de progression animée (montée via `barMounted`, transition CSS transform scaleX).
- La carte est légèrement plus haute quand le score est présent (pas de `paddingBottom` initial).

### Pastille de télétravail

```ts
TELETRAVAIL_OPTIONS.find(o => o.value === offre.mode_travail)?.labelLong ?? offre.mode_travail
```

Libellé long issu de `lib/referentiels.ts` (`TELETRAVAIL_OPTIONS`) dans les deux modes. Valeur brute DB affichée en fallback si la valeur n'est pas dans le référentiel.

### Logo sur la carte compacte

`EntrepriseLogo` taille 36, affiché en en-tête gauche dans le mode compact.

---

## Critères d'offre

### Source unique

`lib/referentiels.ts` est la source de vérité pour toutes les valeurs. Ne pas dupliquer localement.

| Référentiel | Usage côté offre |
|---|---|
| `TELETRAVAIL_OPTIONS` | Filtre et affichage mode_travail offre |
| `TYPES_CONTRAT` | Types de contrat |
| `DUREES_CONTRAT` | Durée des CDD |
| `TEMPS_TRAVAIL` | Groupe horaires (sous-groupe temps) |
| `HORAIRES` | Groupe horaires (sous-groupe horaires) |
| `PERMIS` | Groupe permis |
| `DATE_MIGRATION_CRITERES` | Garde « sans permis » — avant cette date, `permis[]` vide = non renseigné |
| `EXPERIENCES` | Niveau d'expérience |
| `LANGUES` (`lib/langues.ts`) | Langues demandées |

La logique de filtre pure est centralisée dans `lib/offres-filtres.ts` (`matchHoraires`, `matchPermis`, `matchAutres`).

### Règles de filtrage

```
résultat = chaque groupe appliqué successivement (ET entre les groupes)
```

| Groupe | Règle interne |
|---|---|
| Domaine, Contrat, Expérience, Langues | OU entre les valeurs sélectionnées |
| Salaire | offre.salaire_min OU offre.salaire_max ≥ seuil |
| Lieu | correspondance de ville ou rayon géographique |
| Télétravail (mode) | OU entre les valeurs sélectionnées |
| Horaires de travail | OU dans le sous-groupe temps_travail + OU dans le sous-groupe horaires + **ET entre les deux sous-groupes** |
| Permis | OU entre les permis sélectionnés ; `sans_permis` = permis vide ET published_at > `DATE_MIGRATION_CRITERES` |
| **Autres** | **ET entre toutes les cases cochées** |

La règle ET entre les groupes est implicite : chaque filtre actif réduit le résultat du précédent (`applyFiltersOnly` chaîne les `result.filter(…)`).
