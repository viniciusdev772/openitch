---
version: 1
slug: "src-app-jogar-buildid-page-tsx"
primary_target: "src/app/jogar/[buildId]/page.tsx"
related_targets: ["src/components/builds/Player.tsx"]
---

# Surface brief: VibeGames jogar (prévia de build de navegador)

## Scope and mode
- Experience. Visitor success: the creator presses one button on their draft and is inside their own browser game within seconds, at the build's own proportions, with fullscreen one key away.
- Route: /jogar/[buildId] (128-bit random id). Today only the draft's owner sees it (canView in src/lib/builds/access.ts); later, published games reuse it.
- Constraints: no game byte through Vercel. The page is one small server render; the game runs in an iframe from the MinIO play bucket (another origin), sandboxed. Builds that need SharedArrayBuffer reload the page once with COEP so the frame can be cross-origin isolated.
- Assumptions: owner absent; unattended run took the dealt lead (structure 6 of 7) without a decision round.

## Direction contract
THESIS: the game is projected on its track's field and the programme only annotates it from the margin. It refuses the category default of a video-player chrome bar floating over a black letterbox.
OWN-WORLD: the committed programme book: the draft's track colour as a full field (stage), a 2px ink frame with 16px corners around the game at its own aspect ratio, a narrow ruled margin column in paper beside it set like programme margin notes (title in condensed Anybody, engine, Nº of files and size in tabular Anybody, isolation state), pill buttons, lime only for the Jogar action and the live isolation confirmation.
STORY: the creator lands on their game already framed; heavy builds show the exact download size and wait for a Jogar press; fullscreen and open-in-own-tab sit in the margin; a back link returns to the draft.
FIRST VIEWPORT: under the masthead, the track field fills the viewport height; left, the frame holds the running game (or the heavy-build gate with size and Jogar); right, the margin column. Below 960px the margin becomes a ruled strip under the frame.
FORM: programme margin notes beside the projected game; seed: da6bcd48718183bb73857b7f2b534337 (dealt lead 6 of 7).
Signature interaction: fullscreen takes the frame alone; the margin reports isolation as a live state (preparing, isolated, unavailable) in plain words.

## Unresolved
- Public access when publishing exists (canView).
- A dedicated play domain for MinIO to separate builds from each other (shared origin today).
