---
version: 1
slug: "src-app-estante-page-tsx"
primary_target: "src/app/estante/page.tsx"
related_targets: ["src/components/library/Shelf.tsx","src/components/library/LibraryButton.tsx"]
---

# Surface brief: VibeGames estante (jogos guardados, criadores seguidos, novidades)

## Scope and mode
- Operate. Visitor success: a signed-in player finds what they saved for later in seconds, sees what is new from the creators they follow, and can undo either without leaving the page.
- Routes and touch points: /estante; the Guardar toggle on /jogo/[slug] (buy card) and the Seguir toggle on /criador/[slug] (page head) and on the game page's creator card.
- Constraints: private to its owner (no public profile, no counts from other accounts); MongoDB collections saves and follows, 500 items each, slugs checked against the catalogue; forms work without JavaScript.
- Assumptions: owner absent; the wave director pinned the structure (ruled list with Nº, title, track, platforms, price, date saved; followed creators; news from followed creators, newest first; teaching empty state). No roll.

## Direction contract
THESIS: the shelf is the visitor's own page of the programme, their marked copy. It refuses the category default of a wishlist grid of equal cover tiles with heart icons.
OWN-WORLD: the committed programme book unchanged: ultramarine page head shared with the box office, ruled lists with an Anybody numeral column, 6px double rules under section heads, legend codes N W M L A, track chips, rows that fill with their track field on hover, pill toggles whose pressed state is lime (confirmation).
STORY: the visitor sees their saved games as a printed index, notices what is new from people they follow, and opens a game or unsaves one in place, with the row struck through and an undo right there.
FIRST VIEWPORT: ultramarine head "Sua estante" with one line saying only they see it; under it the full-width "Jogos guardados" ruled list with a column header; below, a 7:5 split of "Novidades de quem você segue" and "Criadores que você segue". Empty: a dashed first-use panel showing the real Guardar and Seguir buttons, a catalogue action, and the creators of the programme as links.
FORM: programme index extended to a personal copy; seed: none (pinned).
Signature interaction: unsaving strikes the row through in place instead of deleting it, with the same toggle offering to put it back; Novidades re-forms live as creators are followed or dropped.

## Unresolved
- Header link to /estante (director adds it to the masthead for signed-in visitors).
- Sorting or filtering the shelf once lists grow long.
