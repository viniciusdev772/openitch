---
name: VibeGames
description: A festival programme book for independent games, printed in blue-black ink on cool newsprint with one spot colour per track.
colors:
  ultra: "#2b2fe3"
  ultra-deep: "#1b1ea3"
  lime: "#c8f03c"
  magenta: "#ff4d94"
  tangerine: "#ff8a24"
  teal: "#00a68c"
  teal-ink: "#007a67"
  paper: "#e9ecef"
  paper-deep: "#dde1e6"
  paper-edge: "#c9cfd6"
  paper-bright: "#f5f7f9"
  ink: "#12131b"
  ink-soft: "#3a3e4b"
  ink-mute: "#565b69"
  alert: "#b0003a"
typography:
  display:
    fontFamily: "Anybody Variable, Arial Narrow, sans-serif"
    fontSize: "clamp(5.5rem, 15.5vw, 15rem)"
    fontWeight: 900
    lineHeight: 0.78
    letterSpacing: "-0.035em"
    fontVariation: "'wdth' 52"
  headline:
    fontFamily: "Anybody Variable, Arial Narrow, sans-serif"
    fontSize: "clamp(3.5rem, 9vw, 8rem)"
    fontWeight: 900
    lineHeight: 0.82
    letterSpacing: "-0.03em"
    fontVariation: "'wdth' 52"
  section:
    fontFamily: "Anybody Variable, Arial Narrow, sans-serif"
    fontSize: "clamp(3rem, 7vw, 6rem)"
    fontWeight: 900
    lineHeight: 0.95
    letterSpacing: "-0.02em"
    fontVariation: "'wdth' 55"
  title:
    fontFamily: "Anybody Variable, Arial Narrow, sans-serif"
    fontSize: "1.625rem"
    fontWeight: 800
    lineHeight: 0.95
    fontVariation: "'wdth' 66"
  numeral:
    fontFamily: "Anybody Variable, Arial Narrow, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 800
    lineHeight: 1
    fontFeature: "'tnum' 1"
    fontVariation: "'wdth' 70"
  code:
    fontFamily: "Anybody Variable, Arial Narrow, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 800
    lineHeight: 1
    fontVariation: "'wdth' 75"
  body-lead:
    fontFamily: "Schibsted Grotesk Variable, Helvetica Neue, Arial, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.5
  body:
    fontFamily: "Schibsted Grotesk Variable, Helvetica Neue, Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "'ss01' 1"
  control:
    fontFamily: "Schibsted Grotesk Variable, Helvetica Neue, Arial, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 700
    lineHeight: 1
  label:
    fontFamily: "Schibsted Grotesk Variable, Helvetica Neue, Arial, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 700
    lineHeight: 1.3
  mono:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.9
  caption:
    fontFamily: "Schibsted Grotesk Variable, Helvetica Neue, Arial, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.4
  subtitle:
    fontFamily: "Schibsted Grotesk Variable, Helvetica Neue, Arial, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 500
    lineHeight: 1.35
  entry-row-title:
    fontFamily: "Anybody Variable, Arial Narrow, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 800
    lineHeight: 0.95
    fontVariation: "'wdth' 66"
  entry-index-title:
    fontFamily: "Anybody Variable, Arial Narrow, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 800
    lineHeight: 0.95
    fontVariation: "'wdth' 66"
  heading-sm:
    fontFamily: "Anybody Variable, Arial Narrow, sans-serif"
    fontSize: "2rem"
    fontWeight: 850
    lineHeight: 0.95
    fontVariation: "'wdth' 62"
  heading-md:
    fontFamily: "Anybody Variable, Arial Narrow, sans-serif"
    fontSize: "2.5rem"
    fontWeight: 900
    lineHeight: 0.95
    fontVariation: "'wdth' 58"
  step-numeral:
    fontFamily: "Anybody Variable, Arial Narrow, sans-serif"
    fontSize: "4rem"
    fontWeight: 900
    lineHeight: 0.8
    fontVariation: "'wdth' 55"
rounded:
  swatch: "4px"
  code: "5px"
  thumb: "8px"
  field: "10px"
  card: "12px"
  sheet: "16px"
  pill: "999px"
spacing:
  s-1: "4px"
  s-2: "8px"
  s-3: "12px"
  s-4: "16px"
  s-5: "24px"
  s-6: "32px"
  s-7: "48px"
  s-8: "64px"
  s-9: "96px"
  s-10: "128px"
  gutter: "clamp(16px, 3vw, 40px)"
  max: "1480px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    typography: "{typography.control}"
    rounded: "{rounded.pill}"
    padding: "0 24px"
    height: "44px"
  button-lime:
    backgroundColor: "{colors.lime}"
    textColor: "{colors.ink}"
    typography: "{typography.control}"
    rounded: "{rounded.pill}"
    padding: "0 24px"
    height: "44px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.control}"
    rounded: "{rounded.pill}"
    padding: "0 24px"
    height: "44px"
  button-ghost-hover:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
  button-sm:
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "36px"
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.field}"
    padding: "12px 16px"
    height: "48px"
  input-focus:
    backgroundColor: "{colors.paper-bright}"
  input-cover:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "12px 16px 12px 24px"
    height: "56px"
  segmented:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.pill}"
    padding: "3px"
  segmented-option-selected:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.pill}"
    padding: "8px 16px"
    height: "36px"
  track-toggle:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "0 12px"
    height: "42px"
  platform-toggle-selected:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.pill}"
    padding: "0 12px 0 6px"
    height: "40px"
  legend-code:
    typography: "{typography.code}"
    rounded: "{rounded.code}"
    size: "22px"
  thumb-tab:
    typography: "{typography.code}"
    rounded: "{rounded.field}"
    width: "40px"
    height: "112px"
  entry-art:
    backgroundColor: "{colors.paper-deep}"
    rounded: "{rounded.card}"
  sheet:
    backgroundColor: "{colors.paper-bright}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sheet}"
    padding: "24px"
  tag:
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "3px 12px"
  play-flag:
    backgroundColor: "{colors.lime}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "5px 12px 5px 8px"
  now-pill:
    backgroundColor: "{colors.lime}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "2px 8px"
  status-note:
    backgroundColor: "{colors.lime}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "12px 16px"
---

# Design System: VibeGames

## Overview

**Creative North Star: "The Permanent Programme"**

VibeGames is printed, not rendered. Every page is a spread from a festival programme book: cool grey newsprint, blue-black ink, and spot colours laid down as solid fields. A track does not wear its colour as a badge; it owns a whole band of the page, a page head, a game stage, a card. Ink draws the structure with 2px programme rules and a 6px double rule that opens each section. Everything else sits flat on the paper.

The voice is condensed and loud at the top and plain and readable below. Anybody, pulled narrow, carries the wordmark, section titles, entry titles and every number the programme prints: entry numbers (Nº 0142), times, prices, counts, scores. Schibsted Grotesk carries reading text and every control. Density is a printed schedule's: ruled rows, tabular figures, legend codes for platforms (N W M L A), and entries billed at different sizes rather than repeated as equal tiles.

The page has one wayfinding device of its own, the thumb index: coloured tabs on the page edge, one per track, like the cut tabs of a printed guide. Motion is small and physical (a tab slides out, a card lifts a few pixels, a field recolours). Light is kept for one meaning only: something is live right now.

**Key Characteristics:**
- Cool newsprint paper (never warm cream) with blue-black ink; the page is flat.
- Five spot colours, one per track, used as full fields with ink on top (paper on ultramarine only).
- Anybody at condensed widths for display and numerals; Schibsted Grotesk for text and UI.
- 2px ink programme rules for structure, 1px faint hairlines between rows, 6px double rules under section heads.
- Pill controls and pill-ended bars with 2px ink borders; cards and sheets with 12–16px corners and 2px ink borders.
- Thumb-index tabs, entry numbers and platform legend codes as the recurring programme furniture.
- Glow appears only on live state.

## Colors

A printed two-ink system (paper and blue-black) carrying five saturated spot colours, each of which belongs to one track.

### Primary
- **Programme Ultramarine** (ultra): the cover. Fills the home first viewport, the Experimental track field, the default jams page head, the focus ring, the caret and the active-page underline in the masthead. Paper text sits on it.
- **Night Ultramarine** (ultra-deep): the darkened slot inside an ultramarine field, used behind the screening slot and game stages so the stage reads as a lit screen within the cover.

### Secondary
- **Acid Lime** (lime): the signal ink. It is the Navegador track field, and outside that track it marks only three things: the action on a coloured field (the search button, "Página do jogo"), confirmation and selection (text selection, the selected platform code, the publish confirmation, the drop zone on hover), and live state (the cover's pulsing dot, the "agora" line and pill on the jam schedule). It is also the highlighted half of the wordmark on the cover and in the colophon.

### Tertiary
- **Hot Magenta** (magenta): the Narrativo track field.
- **Signal Tangerine** (tangerine): the Ação track field.
- **Programme Teal** (teal): the Quebra-cabeça track field.
- **Teal Ink** (teal-ink): the text-safe teal (4.5:1 on paper) for a completed step number in the publish sequence; plain teal fails large-text contrast on paper.

### Neutral
- **Cool Newsprint** (paper): the page. Body background, the masthead, inputs, toggles at rest, and the text colour on ultramarine and on ink.
- **Second Sheet** (paper-deep): recessed paper. Hover on quiet controls, the background behind entry art, past jam bars and past jam cards, the scrollbar track.
- **Paper Edge** (paper-edge): the border of a past (spent) schedule bar; the faintest structural grey.
- **Bright Stock** (paper-bright): a slightly whiter sheet laid on the page for proof panels, the buy card and a focused input. Currently written as a literal in the stylesheet, not a custom property.
- **Blue-Black Ink** (ink): all text, every rule and border, primary buttons and the colophon field. Hairlines are this ink at 28% opacity (`color-mix(in oklab, ink 28%, transparent)`).
- **Soft Ink** (ink-soft): secondary reading text, section intros, taglines in lists.
- **Muted Ink** (ink-mute): metadata, hints, placeholders, file sizes, axis labels.
- **Alert Red** (alert): inline form errors only.

### Track mapping
Navegador = lime, Ação = tangerine, Narrativo = magenta, Quebra-cabeça = teal, Experimental = ultra. A track's text colour on its own field is ink for lime, tangerine, magenta and teal, and paper for ultramarine. Components receive a track as two custom properties, `--c` (field) and `--on` (text on field), and never hard-code a track hex.

### Named Rules
**The Full Field Rule.** A track colour is laid down as a field: a band, a page head, a game stage, a jam card, a preview sheet, the hover fill of a schedule row. The only small use is the 12–14px ink-bordered swatch that keys a track name in a legend or chip.

**The Ink On Spot Rule.** Text on lime, tangerine, magenta and teal is ink; text on ultramarine and on ink is paper. No other text colour sits on a spot field.

**The Lime Means Go Rule.** Off its own track, lime marks the action on a field, a confirmation or selection, or something live. It is never decoration.

## Typography

**Display Font:** Anybody Variable (with Arial Narrow, sans-serif), width axis used between 50% and 80%
**Body Font:** Schibsted Grotesk Variable (with Helvetica Neue, Arial, sans-serif)
**Label/Mono Font:** none distinct; labels are Schibsted Grotesk. A system monospace appears only inside the file-tree proof panel.

**Character:** A poster face squeezed narrow and set heavy and tight against a sturdy, slightly bookish grotesk. The condensed face shouts the programme's names and numbers; the grotesk reads and operates.

### Hierarchy
- **Display** (900, clamp(5.5rem, 15.5vw, 15rem), 0.78, width 52%): the cover wordmark only. The colophon repeats it smaller (clamp(4rem, 10vw, 9rem), 0.8).
- **Headline** (900, clamp(3.5rem, 9vw, 8rem), 0.82, width 52%): page titles (catalogue, game title, jams, publish).
- **Section** (900, clamp(3rem, 7vw, 6rem), 0.95, width 55%): section heads on the home programme. Track band names run narrower (width 50%, clamp(3rem, 5.2vw, 5.75rem), 0.86).
- **Title** (800, 1.625rem, width 66%): entry titles. Lead and wide entries step up to clamp(2.25rem, 4vw, 3.25rem) at width 60% and 900; row entries drop to 1.375rem; step and sub-section heads sit between at 2–2.5rem, width 60–65%.
- **Numeral** (800, 1.75rem, width 70%, tabular figures): times in the lineup. The same face carries entry numbers (600, width 80%), prices (750, width 75%), step numbers (900, 4rem, width 55%), buy-card amounts (900, 3rem, width 62%), scores and counts.
- **Code** (800, 0.75rem, width 75%): platform legend letters and thumb-index tab names (0.8125–0.875rem, width 70%).
- **Body lead** (400, 1.0625rem, 1.5; 1.65 in long prose): section intros, band blurbs, game description, max 44–66ch.
- **Body** (400, 1rem, 1.5): default reading text and taglines (0.875–0.9375rem, 1.4 in entries).
- **Control** (700, 0.9375rem, 1): buttons and primary nav; toggles and options run 650 at 0.875–0.9375rem.
- **Label** (700, 0.8125rem, sentence case): field labels, fieldset legends, card state lines, colophon headings.

### Named Rules
**The Narrow Voice Rule.** Anybody is always condensed: 50–58% for display and page heads, 60–70% for titles and times, 70–80% for codes, prices and entry numbers. It never runs at its default width.

**The Printed Numbers Rule.** Every number the programme prints (entry number, time, price, count, step, score) is set in Anybody with tabular figures. Schibsted Grotesk never carries a headline number.

**The Sentence Case Rule.** Labels, legends and buttons are sentence case Schibsted Grotesk. Nothing in the system is set in uppercase or letter-spaced caps.

## Layout

A single centred column, max 1480px plus the tab rail, with a fluid gutter (clamp(16px, 3vw, 40px)). From 1100px up the thumb index becomes a fixed rail on the right edge and the wrapper reserves 44px on the right for it; below 1100px the tabs become a horizontally scrolling strip under the masthead.

The grid is asymmetric by default. Two-column splits run 7:5 (cover, page heads, game body, publish), 5:7 (section heads, pitch rows), 4:8 alternating with 8:4 (track bands flip on every other band), and 3:2 inside bands. Entries are billed at different scales: a lead entry spans two columns and two rows of the catalogue grid, a wide entry spans two columns, row entries stack beside the lead. Catalogue and "more" grids auto-fill from 240px and 220px minimums with dense packing.

Spacing follows a 4px-based scale (4, 8, 12, 16, 24, 32, 48, 64, 96, 128). Sections breathe at 96px top and bottom (64px under 800px); bands at 64px; cards and sheets pad 16–24px. Schedule-like lists (today's lineup, the catalogue index, past jams, downloads, details) are ruled rows: a fixed-width numeral column at the left, title in the flexible column, metadata and price aligned right, a hairline under each row. The masthead is sticky at 64px; sticky side columns (filters, buy card, publish preview) sit at 88px from the top.

Main breakpoints: 640px (lists drop thumbnails, entry grids go single column), 960px (two-column layouts stack; the publish preview moves above the form), 1100px (the thumb-index rail appears). Components adjust at a few more widths (480, 560, 720, 760, 800, 860, 900, 1180px).

### Named Rules
**The Billing Rule.** Entries vary in scale by billing (lead, wide, card, row). Never fill a surface with a row of equal cards.

**The Ruled List Rule.** A list of entries or events is a ruled programme list with a numeral column, not a stack of boxes.

## Elevation & Depth

The page is flat paper. Depth comes from ink borders, recessed paper tones (paper-deep under art, paper-bright for laid-on sheets) and colour fields, not from shadows. One soft lift shadow exists and appears only on hover of buttons and entry art, and under the floating game-overlay message. Focus on inputs is a translucent ultramarine halo; focus everywhere else is a 3px ultramarine outline offset 2px (lime on ultramarine and other dark fields).

### Shadow Vocabulary
- **Lift** (`box-shadow: 0 10px 24px -12px color-mix(in oklab, #12131b 55%, transparent)`): hover on buttons and entry art, paired with a 1–3px rise.
- **Input halo** (`box-shadow: 0 0 0 4px color-mix(in oklab, #2b2fe3 35%, transparent)`): focused text inputs and textareas.
- **Tab pull** (`box-shadow: inset -5px 0 0 #12131b` on the rail, `inset 0 -4px 0 #12131b` on the strip): the active thumb-index tab, an ink bar, not a shadow.
- **Live glow** (`box-shadow: 0 0 10px 2px color-mix(in oklab, #c8f03c 65%, transparent)`): the "agora" line on the jam schedule. The cover's live dot pulses a lime ring outward (0 to 10px over 2.4s).

### Named Rules
**The Flat Paper Rule.** Surfaces are flat at rest. A shadow is a response to hover, never a resting state.

**The Glow Means Live Rule.** Glow and pulse belong only to something happening now: the schedule's "agora" line, a live dot. Nothing else glows.

## Shapes

Rounded but drawn. Every container and control has a 2px ink border and a moderate radius; the radius grows with the size of the object: 4px swatches, 5px legend codes, 8px thumbnails and small selects, 10px inputs, toggles and tabs, 12px entry art and notes, 16px sheets, cards, drop zones and the game stage. Controls that act or select are full pills (999px): buttons, the segmented control, platform toggles, tags, the play flag, the now pill and schedule bars. On ultramarine the border colour flips to paper (the screening slot).

Rules are the other half of the form language. A 2px solid ink rule closes the masthead, page heads, bands and results bars and opens each step, the details list and the downloads list. A 6px double ink rule sits under every section head and list title. Between rows a 1px hairline at 28% ink. Inside entries and jam cards a 1.5px rule in the current text colour separates the foot. Dashed 2px borders mean "empty, put something here": the drop zone, the open slot in a track band, the empty catalogue state; they go solid on hover.

The thumb-index tab is the one cut shape: rounded only on its outer corners (10px 10px 0 0 on the strip, 10px 0 0 10px on the rail), with no border on the side that meets the page, and its text runs vertically on the rail.

## Components

### Buttons
Solid, pill-shaped and inked: they look like stamped tokens.
- **Shape:** full pill (999px), 2px border, min height 44px (36px small), 0 24px padding (0 16px small), 18px inline icon with an 8px gap.
- **Primary:** ink fill, paper text, 700 weight.
- **Lime:** lime fill and border, ink text. The action button on a coloured field (cover search, game page link).
- **Ghost:** transparent with a border in the current text colour; on hover it fills with ink and turns paper (inside a track band it fills with the band's text colour and takes the band colour as text).
- **Hover / Focus:** rise 1px plus the lift shadow over 180ms; active returns flat. Disabled at 45% opacity with no lift. Focus is the 3px ultramarine outline (lime on dark fields).

### Chips and tags
- **Track chip:** a 12px swatch with 3px corners and a 1.5px ink border, then the track name at 0.8125rem/650. It keys the colour; it never becomes a coloured pill.
- **Tag:** 1.5px ink border, pill, 3px 12px, 0.8125rem/650; hover fills ink.
- **Play flag:** lime pill with a 1.5px ink border and a filled play glyph, "Joga aqui", pinned 12px from the top right of browser-playable entry art.

### Platform legend codes
Single letters N W M L A in 22px squares (5px corners, 1.5px current-colour border), Anybody 800 at 75% width. The full row of five always prints; platforms an entry lacks drop to 22% opacity, so the row reads like a printed legend. In the platform filter the code becomes a 26px circle and turns lime on ink when selected.

### Inputs / Fields
- **Style:** paper background, 2px ink border, 10px corners, 48px min height, 12px 16px padding; ink-mute placeholder.
- **Focus:** no outline; the 4px ultramarine halo and a shift to bright stock (paper-bright).
- **On the cover:** pill-shaped, paper border, 56px tall, 24px left padding, 1.0625rem text.
- **Error:** alert-red inline text at 0.875rem/650 under the field.
- **Labels:** label style above, ink-mute hint below at 0.8125rem.

### Segmented control and toggles
- **Segmented:** a 2px ink pill holding pill options with a 3px inset; selected option is ink with paper text; hover is paper-deep. In the filters column and on narrow screens it becomes a 16px-corner grid with 12px-corner options whose column count follows the option count.
- **Track toggle:** full-width 42px row, 2px ink border, 10px corners, swatch plus name on the left and a tabular count on the right; pressed, it fills with its track field.
- **Platform toggle:** 40px pill with its legend code; pressed, ink with a lime code.

### Cards / Containers
- **Entry:** art in a 2px ink frame with 12px corners (8px for row entries) on paper-deep; under it an entry line (Nº number left, codes or track chip right), title, tagline, and a foot ruled 1.5px with creator left and price right. Hover lifts the art 3px with a -0.4deg tilt and the lift shadow over 320ms.
- **Sheet (proof panel, buy card):** bright stock, 2px ink border, 16px corners, 24px padding.
- **Jam card / preview sheet:** the track field itself as the background, 2px ink border, 16px corners, 24px padding; a past jam card goes to paper-deep.
- **Screening slot:** the cover's frame for the featured browser game, 2px paper border, 14px corners, night ultramarine inside, with a head (entry number; a live dot only when something is actually live) and a foot (title, creator, price, lime button) ruled 2px in paper. While the programme has no game it stays as an open slot: a dashed paper frame inside the stage saying the room is ready, and a lime "Começar um rascunho" action.

### Navigation
- **Masthead:** sticky paper bar, 64px, closed by a 2px ink rule. Wordmark in Anybody 900 at 58% width, 1.875rem, with a small ink-mute descriptor (hidden under 720px). Nav links at 0.9375rem/600 with a 3px underline that wipes in from the left on hover (260ms); the current page's underline is ultramarine. "Publicar" is a small primary button.
- **Empty programme:** a dashed 16px-corner frame ("empty, put something here") with a heading, one line saying what will appear and the next concrete step as a button. Used wherever the catalogue, jams, diary, tags, collections or creators have nothing yet.
- **Colophon:** an ink field closing every page, with the wordmark at display scale and three columns of links under label-style headings.

### Thumb index (signature)
One tab per track in its field colour, with track-name text in that track's text colour, Anybody 800 at 70% width. On the rail (1100px and up) the tabs are 40×112px, stacked 3px apart, fixed at the right edge, text running vertically; hover widens a tab to 48px, the current track's tab to 56px with a 5px ink bar on its inner edge. Below 1100px they form a scrolling strip of 40px tabs under the masthead, current tab raised with a 4px ink underbar. On the home page the current tab follows the track band in view; in the catalogue it follows the track filter, and selecting a track recolours the page head to that field over 420ms.

### Programme lists
Today's lineup, the catalogue index and past jams are ruled lists: a fixed numeral column (time or Nº), an optional 2px-framed thumbnail, the title in Anybody, metadata in Schibsted, price right-aligned. A whole row fills with its track colour on hover (12px or 10px corners, 200ms).

### Jam schedule
A timeline of pill bars (2px ink border, track field, 0.75rem/750 labels) over weekly gridlines at 12% ink. Past bars are paper-deep with paper-edge borders. A single lime "agora" line with the live glow runs through every lane, topped by a lime pill on the axis.

### Publish sequence
Numbered steps in a 72px margin column, numbers in Anybody 900 at 4rem, each step opened by a 2px ink rule. A dashed 16px-corner drop zone turns lime and solid on hover or drag. The preview column shows the real programme entry on its track field and updates in place. Step 6, "No programa", closes the sequence: a bright-stock sheet (2px ink, 16px corners) with the state line (draft, or a 12px lime live dot with an ink border, pulsing, plus the entry number when it is on air), a ruled "what is missing" list (2px ink rule under a label and a tabular count, hairlines between items, an "Ir ao campo" link that focuses the field), a lime-ticked "Tudo pronto" line when nothing is missing, and the actions: "Publicar no programa" (primary) or, on air, "Ver a página publicada" and "Tirar do ar" (ghost). The confirmation is the lime ok note. In the drafts list an on-air row prints the same live dot and "No programa" under its tagline, and gains a ghost "Ver" action.

### Owner strip
On a public game or creator page, the owner alone gets a full-width ink strip under the masthead: a soft-paper line ("Este jogo é seu. Só você vê esta faixa.") and pill actions, lime "Editar" (the action on a field) and paper-bordered ghosts "Tirar do ar" and "Excluir". Excluir turns the strip itself into the confirmation, closed by a 2px alert rule, with an alert-filled "Excluir de vez" and "Manter"; no modal. The editor's step 6 carries the same delete as a quiet link that becomes an inline confirmation.

### Featured screening
When a browser game is published, the cover's screening slot shows the newest one: head "Em cartaz" with the live dot and the entry number, the game's cover on its own ground filling the stage (the stage opens the game), and the foot with title (links to the game page), creator and price, and a lime "Jogar agora".

## Do's and Don'ts

### Do:
- **Do** lay a track's colour down as a whole field (band, page head, stage, card, sheet) and pass it to components as `--c` and `--on`.
- **Do** set ink on lime, tangerine, magenta and teal, and paper on ultramarine and ink.
- **Do** draw structure with ink: 2px solid rules for edges, a 6px double rule under section heads, 1px hairlines at 28% ink between rows.
- **Do** give controls and containers a 2px ink border; use full pills (999px) for buttons, toggles, tags and bars, and 10–16px corners for fields, cards and sheets.
- **Do** set every printed number (Nº entry number, time, price, count, step) in condensed Anybody with tabular figures.
- **Do** show all five platform legend codes (N W M L A) and fade the absent ones to 22%.
- **Do** bill entries at different sizes (lead, wide, card, row) and print lists as ruled rows with a numeral column.
- **Do** keep motion short and physical on the shared ease-out curve (cubic-bezier(0.16, 1, 0.3, 1)): 160–180ms for controls, 220–260ms for tabs and underlines, 320ms for entry lift, 420ms for a field recolour; honour reduced motion.

### Don't:
- **Don't** use a track colour as a small sticker, badge or text accent on paper; the only small form is the ink-bordered legend swatch.
- **Don't** set Anybody at its default width or use it for reading text or controls.
- **Don't** glow, pulse or neon-light anything that is not live right now.
- **Don't** give surfaces a resting shadow; lift only on hover.
- **Don't** warm the paper toward cream or darken the page into a gamer-store black; the page is cool newsprint and ink.
- **Don't** set labels or buttons in uppercase or letter-spaced caps.
- **Don't** use lime off its own track for anything except an action on a field, a confirmation or selection, or live state.
