---
version: 1
slug: "src-app-etiquetas-page-tsx"
primary_target: "src/app/etiquetas/page.tsx"
related_targets: ["src/app/etiqueta/[tag]/page.tsx"]
---

# Surface brief: tag index (/etiquetas) and tag page (/etiqueta/[tag])

## Scope and mode
- Route `/etiquetas`: every tag the creators gave their games, grouped by initial letter. Mode: Operate (scan, jump to a letter, open a tag).
- Route `/etiqueta/[tag]`: one tag. Mode: Operate (scan the games that carry it, move to a track, a related tag or the filtered catalogue).
- Visitor success: finds a theme they like ("chuva", "um botão") faster than by searching, sees how many games carry it, and opens a game.
- Slugs: lowercase, no accents, spaces to hyphens; the page maps the slug back to the tag and matches games without case or accents. Unknown slug: not-found page that points back to the index.
- Constraints: owner absent; the index starts empty (demonstration content removed by the owner); counts are counts of entries, never presented as popularity.

## Direction contract
THESIS: the tag index is the back-of-book index of the printed programme; it refuses the category default of a word cloud with random sizes and colours.
OWN-WORLD: inherited from DESIGN.md: paper page head, a full A–Z letter strip set as legend codes (absent letters faded to 22%), letter groups headed by a large condensed Anybody capital over the 6px double rule, ruled index lines with the tag name in Anybody and the count right-aligned in tabular Anybody. Billing by count in four fixed steps, never free scaling. A row fills with the field of the track where that tag lives most, as in the catalogue index.
STORY: the visitor scans letters like a printed index, reads which tags weigh most by their billing, opens a tag, sees its games as a ruled list, the tracks it crosses and the tags that travel with it, and moves on to a game.
FIRST VIEWPORT: page head (title "Etiquetas", one-line intro); a results bar with the counts on the left and the letter strip on the right; the index columns (three on desktop, two on tablet, one on phone) start above the fold.
FORM: extension of the storefront programme surface; seed: none (pinned) "como o índice remissivo no fim de um programa impresso: agrupado por letra inicial, cada etiqueta com a contagem em Anybody tabular, tamanho variando pela contagem (Billing Rule) sem virar nuvem de palavras caótica"; the world is the committed DESIGN.md.
Signature: whole-row fill in the tag's main track colour on hover, and the faded legend-code alphabet.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved
- Creator-entered tags have no moderation or merge rules yet (synonyms such as "crafting" and "artesanato" stay separate).
