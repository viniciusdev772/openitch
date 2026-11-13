---
version: 1
slug: "src-app-jams-slug-page-tsx"
primary_target: "src/app/jams/[slug]/page.tsx"
related_targets: []
---

# Surface brief: jam page (/jams/[slug])

## Scope and mode
- Route `/jams/[slug]`, one page per jam; extends the storefront's `/jams` (see the src-app-page-tsx brief). Mode: Operate, with Experience touches in the page head (the jam's track field, the theme set large, the clock).
- Visitor success: in seconds knows whether the jam is over, live or upcoming and how long remains; reads the rules and criteria; sees the entries; a creator reaches "Enviar um jogo" (to `/publicar?jam=<slug>`) while the jam is open or upcoming.
- Content: theme, host (linked to the creator page when the host is a creator), date window, rules and criteria (optional `rules`/`criteria` on Jam, otherwise derived on the page from theme, summary and window), entries = games with `game.jam === slug`. The agenda starts empty.
- Constraints: owner absent; decisions taken unattended. No platform fee, prize or voting policy may be invented.

## Direction contract
THESIS: a jam page is the programme's event sheet for one time-boxed event; it refuses the category default of a hero banner over a grid of equal submission tiles.
OWN-WORLD: inherited whole from DESIGN.md (the programme book): the jam's track colour as the full page-head field, an ink-bordered bright-stock status sheet, Anybody numerals with tabular figures, ruled lists with a numeral column, 6px double rules under section heads.
STORY: the visitor reads the state and the clock, the theme, then the rules; a creator sends a game; a player opens the entries.
FIRST VIEWPORT: track-field page head split 7:5. Left: crumbs, the jam title at headline scale, the theme in condensed Anybody, the summary. Right: the status sheet with the state line, the countdown (client only), the window, the host, the entry count and the send action.
FORM: extension of the storefront programme surface; seed: none (pinned) "Modo Operate com toques de Experience"; the world is the committed DESIGN.md.
Signature: the clock in the status sheet; the live state is the only thing on the page that glows (lime live dot), per Glow Means Live.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved
- Real submission flow, voting and results; whether entries stay hidden until the deadline.
