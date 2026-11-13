---
version: 1
slug: "src-app-colecoes-page-tsx"
primary_target: "src/app/colecoes/page.tsx"
related_targets: ["src/app/colecoes/[slug]/page.tsx"]
---

# Surface brief: programme collections (/colecoes and /colecoes/[slug])

## Scope and mode
- Route `/colecoes`: index of the curated blocks of the programme. Route `/colecoes/[slug]`: one block read in full.
- Mode: Read. The visitor came to understand why these games sit together and why each one is there; the covers give it a touch of Experience (the art is billed large), but the reading order and the curator's notes lead.
- Visitor success: picks a block that matches the moment (a bus ride, one free hand, no clock), reads the curator's reason for each game, and opens a game page.
- Source: `src/data/colecoes.ts` (8 synthetic blocks, ordered slugs plus a note per game), every game from `src/data/catalog.ts`. Each block's claim is backed by catalogue fields (session, platforms, controls, accessibility, tags); a block's track is the most frequent track among its games.
- Constraints: owner absent and no one to ask (subagent); all text is sample material and the page says so; no counts beyond counts of entries; curators who sign a block never include their own games ("Equipe do programa" signs blocks that do).

## Direction contract
THESIS: collections are the programme's themed blocks, printed like the block pages of a festival book: a field-coloured opener and a numbered running order with the curator's note set beside each title. It refuses the category default of a carousel or grid of equal "playlist" cards.
OWN-WORLD: the committed programme book unchanged: track colour only as whole fields (lead block, page head, row hover), ink on lime/tangerine/magenta/teal and paper on ultramarine, Anybody condensed for titles and every numeral, Schibsted for the notes, 2px ink rules, 6px double rule under section titles, hairlines between rows, 2px-framed mini covers.
STORY: the reader scans the blocks billed at three sizes, opens one, reads the opener and then the running order (the first game billed larger), follows a note into a game, and at the end moves to another block.
FIRST VIEWPORT: index: paper page head 7:5 (title "Coleções", one-line lead); under it the lead block as a full track field, 5:7, title at band scale, intro, curator line, then its first five covers, the first billed large beside a 2 × 2 block of the next four; the next two blocks start below as smaller field cards side by side. Detail: page head in the block's field with crumbs, headline title, intro and curator; the running order starts on paper with entry 01 billed large (cover, title, note in lead size beside it).
FORM: extension of the storefront programme surface; seed: none (pinned) "uma em destaque com o campo de cor da trilha, as outras como linhas pautadas ou cartões menores" / "lista numerada de programa em que cada entrada tem a nota da curadoria ao lado (lead em tamanho maior)"; the world is the committed DESIGN.md.
Signature: the running order as a numbered programme with the curator's note in the margin column; rows in the ruled list of blocks fill with that block's track field on hover.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved
- Who may curate once real accounts exist (staff only, invited creators, anyone) and how a creator asks to leave a block.
- Whether blocks rotate on the home page and how often.
