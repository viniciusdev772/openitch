---
version: 1
slug: "src-app-conta-projetos-page-tsx"
primary_target: "src/app/conta/projetos/page.tsx"
related_targets: ["src/components/projetos/DraftList.tsx"]
---

# Surface brief: openitch rascunhos (/conta/projetos) and saving drafts from Publicar

## Scope and mode
- Operate. Visitor success: a signed-in creator finds every game they started in Publicar, sees when each was last saved, and reopens or deletes one in a click, without ever wondering whether the work is safe.
- Routes and touch points: /conta/projetos (private list); /publicar saves and reopens drafts (?projeto=<id>, ?jam=<slug>); a shortcut in /conta.
- Constraints: private to its owner; MongoDB collection projects, 20 drafts per account, rate-limited writes; file upload and payments do not exist and no screen may imply they do; publishing a draft does not exist yet.
- Assumptions: owner absent; the wave director pinned the structure. No roll.

## Direction contract
THESIS: drafts are the creator's proofs at the printer, entries set but not yet billed in the programme. It refuses the category default of a dashboard grid of equal project cards with progress bars.
OWN-WORLD: the committed programme book unchanged: ultramarine box-office page head, a ruled list with an Anybody date numeral column, track chips keyed by swatch, rows that fill with their track field on hover, pill actions, 6px double rule under the list head, alert red only for the delete confirmation.
STORY: the creator sees their drafts as a ruled proof list, newest first, opens one straight into the publish sequence, or deletes one after an inline confirmation in the row itself.
FIRST VIEWPORT: ultramarine head "Seus rascunhos" with one line saying only they see them and how many of the 20 are used; under it the full-width ruled list (date, title and tagline, track, jam, Abrir, Excluir). Empty: a dashed first-use panel that prints the five publish steps as the margin sequence, a "Começar um rascunho" action and jams open for entries as direct starts.
FORM: ruled proof list inside the box office; seed: none (pinned) "lista pautada (título, trilha, atualizado em, Abrir, Excluir), com estado vazio que ensina o primeiro passo".
Signature interaction: Excluir turns the row itself into the confirmation (alert rule, "Excluir de vez" and "Manter"), no modal; in Publicar the save line under the preview says "Salvo às HH:MM" and turns to "Alterações não salvas" the moment the entry changes.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved
- Publishing a draft into the programme (needs file storage).
- Link to /conta/projetos in the masthead account area (director).
