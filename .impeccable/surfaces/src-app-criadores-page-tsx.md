---
version: 1
slug: "src-app-criadores-page-tsx"
primary_target: "src/app/criadores/page.tsx"
related_targets: []
---

# Surface brief: creators index (/criadores)

## Scope and mode
- Route `/criadores`: index of every creator in the programme. Mode: Operate (scan, sort, open a creator).
- Visitor success: finds a creator by name or by who published most recently, sees city, game count, the tracks they publish in and their latest game, and opens `/criador/<slug>`.
- Sorting: "Mais recentes" (default) and "A–Z" via the `ordem` search param, drawn as the existing segmented control with links (works without JavaScript).
- Constraints: owner absent; the roster starts empty (demonstration content removed by the owner); no follower counts or invented metrics.

## Direction contract
THESIS: the creators index is the programme's list of contributors, a ruled roster; it refuses the category default of a grid of equal avatar cards.
OWN-WORLD: inherited from DESIGN.md: paper page head, a ruled list with a numeral column (date of the latest release in condensed Anybody, tabular), names in Anybody, legend swatches for tracks, a row that fills with the creator's main track field on hover.
STORY: the visitor scans who published lately, sorts A–Z when looking for a name, opens a creator or jumps straight to their latest game.
FIRST VIEWPORT: page head (title "Criadores", one-line intro); a results bar with the count on the left and the order control on the right; the ruled roster starts above the fold.
FORM: extension of the storefront programme surface; seed: none (pinned) "lista pautada (não grade de cartões iguais)"; the world is the committed DESIGN.md.
Signature: whole-row fill in the creator's main track colour on hover, as in the catalogue index.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved
- Search or filter by city or track once the roster grows; creator avatars do not exist.
