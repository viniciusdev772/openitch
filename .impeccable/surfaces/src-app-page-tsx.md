---
version: 1
slug: "src-app-page-tsx"
primary_target: "src/app/page.tsx"
related_targets: ["src/app/jogos/page.tsx","src/app/jogo/[slug]/page.tsx","src/app/publicar/page.tsx","src/app/jams/page.tsx"]
---

# Surface brief: openitch storefront (home, catalog, game page, publish, jams)

## Scope and mode
- Home `/`: Persuade. Visitor success: understands this is an open home for indie games within seconds, then plays, searches, or starts publishing.
- Catalog `/jogos`, Publish `/publicar`, Jams `/jams`: Operate. Game page `/jogo/[slug]`: Experience (the game leads).
- Audience, job, constraints: see PRODUCT.md. All catalog content is synthetic sample data, labelled in the UI.
- Assumptions: the owner asked for no questions; direction proceeded unattended on the assigned roll.

## Direction contract
THESIS: openitch is a festival that never closes, and every page is its printed programme. It refuses the category default of a dark gamer store with a uniform thumbnail grid and neon accent.
OWN-WORLD: a festival programme book. Cool newsprint paper and blue-black ink; each section (track) owns a saturated spot colour as a full field, never a sticker: ultramarine cover, acid lime, hot magenta, tangerine, teal. Anybody (variable width) for headlines, entry numbers and times; Schibsted Grotesk for body and controls. Thumb-index tabs on the page edge, entry numbers (Nº 0142), legend codes for platforms (N W M L A), programme rules between entries. Live state only glows when something is actually live.
STORY: the visitor sees a game playing on the cover, scans today's lineup like a screening schedule, learns anyone can publish at their own price, and either plays, searches, or opens Publicar.
FIRST VIEWPORT: the programme cover drenched in ultramarine fills the width. Left two-thirds: the wordmark set huge in condensed Anybody, one-line hook, a working search field and a Publicar action. Right third: the featured entry "Órbita" actually playable in a canvas framed as a screening slot, with its entry number and price. Thumb-index tabs run down the right edge. The start of "Hoje no programa" (a timed list of new entries) shows under the fold line.
FORM: festival programme catalog, position 6 of 7 on the ordered list; seed:c55c6c9fe02b9dac.
Raised by declined challengers:
- Raise (drum machine step row): a single running "agora" line marks now on the jam schedule; glow is reserved for live state only.
- Raise (HyperCard stack, competitive): browse and author are one object; the Publicar form edits the very programme entry it previews, in place.
- Raise (orizuru crane sequence): publishing is a numbered sequence in a strict margin column, every step recoverable.
- Raise (cassette deck fascia): every catalog filter is its own visible labelled control; nothing hides in a dropdown.
- Raise (monochrome product marketing): each creator-facing claim sits beside the working interface detail that proves it.
- Raise (raku): asymmetry is the grid's law; entries vary in scale by billing, never a row of equal cards.
Signature interaction: thumb-index tabs that recolour the page to their track, plus the playable cover slot.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved
- Real payments, auth, storage; fee policy; English copy.
