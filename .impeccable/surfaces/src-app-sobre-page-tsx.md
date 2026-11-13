---
version: 1
slug: "src-app-sobre-page-tsx"
primary_target: "src/app/sobre/page.tsx"
related_targets: ["src/app/ajuda/page.tsx","src/app/novidades/page.tsx","src/app/novidades/[slug]/page.tsx"]
---

# Surface brief: openitch guia do programa (sobre, ajuda, novidades)

## Scope and mode
- Read. Visitor success: understands what openitch is and what it does today, finds the answer to a concrete question in seconds, and reads what changed in the programme.
- Routes: /sobre (article), /ajuda (guide and FAQ by subject), /novidades (dated feed of devlogs and release notes), /novidades/[slug] (one note in full).
- Audience: players, creators and jam hosts from PRODUCT.md; first-time visitors arriving from the colophon or menu.
- Source material: PRODUCT.md (principles, rewritten for the public), src/lib/auth/* (account facts: limits, session lengths, recovery), src/data/catalog.ts (games, creators), src/data/devlogs.ts (synthetic notes).
- Constraints: no claims about fees, payment provider, user counts or revenue; payments and file upload do not exist and are said so; every note is sample material.
- Assumptions: run as a subagent with no one to ask; the structure was taken from the dealt lead without a decision page; the visual world is the committed programme book, unchanged.

## Direction contract
THESIS: the guide is the programme book's front and back matter: a reference apparatus printed in the same inks as the programme. It refuses the help-centre default of a search box over a grid of icon cards and an accordion of collapsed questions.
OWN-WORLD: the committed world unchanged. Ultramarine page head with paper type for /sobre and /ajuda; the game's track field as the page head of a single note; cool newsprint below; Anybody condensed for titles, question heads and every number; Schibsted Grotesk for the reading column; 2px ink rules, 6px double rule under every section title, 1px hairlines between rows.
STORY: the reader sees where they are in the guide (running-head strip linking the three parts), reads a short answer to "what is this", jumps by the margin contents to the subject they need, and leaves through a link that does the thing (publicar, jogos, jams, criar conta, conta).
FIRST VIEWPORT: page head 7:5, headline title left, one plain lead right; under it the running-head strip; then a 3:9 split: sticky margin contents (subject names with tabular question counts) left, reading column at 68ch right opening with the first section title over its double rule.
FORM: reference-book apparatus, position 4 of 7 on the ordered list (dealt lead); seed:d3253f0306c5c5b2.
Signature interaction: questions printed as ruled term/definition pairs (question in condensed Anybody on the left, answer in the reading face on the right), anchor-linkable; the diário printed as a dated ruled list whose numeral column carries day and time, rows filling with the game's track field on hover, the newest launch billed larger with its cover.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Ordered structures (for later rounds)
1. Front matter with sticky margin contents and a calm column. 2. Pure timetable, every page as timed rows. 3. Pocket field guide with full-field chapter openers per subject. 4. Reference-book apparatus (built). 5. Newspaper wayfinding with an index box and page jumps. 6. Alphabetical glossary. 7. Accordion FAQ (category default).

## Unresolved
- Platform fee, payment provider and moderation policy; the guide says they are undecided.
- Email channel for account recovery; the guide says recovery codes are the only route today.
- Search inside the guide, once the guide grows past one screenful of subjects.
