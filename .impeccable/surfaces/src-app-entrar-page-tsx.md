---
version: 1
slug: "src-app-entrar-page-tsx"
primary_target: "src/app/entrar/page.tsx"
related_targets: ["src/app/criar-conta/page.tsx","src/app/recuperar/page.tsx","src/app/entrar/verificar/page.tsx","src/app/conta/page.tsx","src/app/conta/duas-etapas/page.tsx"]
---

# Surface brief: openitch box office (entrar, criar conta, recuperar, verificação em duas etapas, conta)

## Scope and mode
- Operate. Visitor success: gets in (or back in) to their account in one pass, and can see and control exactly where they are signed in and how their account is protected.
- Routes: /entrar, /entrar/verificar, /criar-conta, /recuperar, /conta, /conta/duas-etapas.
- Constraints: own auth system, no third-party auth libs; MongoDB without schemas; no email channel exists, so recovery runs on single-use recovery codes issued at sign-up.
- Assumptions: the owner delegated the structure choice ("escolha você mesmo"); the dealt lead was taken.

## Direction contract
THESIS: signing in is the festival box office, the counter where a visitor collects their credential. It refuses the category default of a floating centred card on a blurred gradient with social-login buttons.
OWN-WORLD: the committed programme book world unchanged: cool newsprint, blue-black ink, ultramarine page head field with paper type, Anybody condensed for page titles and every number, Schibsted Grotesk for fields and controls, 2px ink rules, 6px double rule under list heads, pill buttons, 10px fields. Lime only for confirmation and the live "esta sessão" marker.
STORY: the visitor lands on a page head that names the counter, fills a short ruled form, and either enters or is told exactly what to fix; signed in, the account page reads like their own programme: who they are, then their sessions as a timed schedule, then their protections.
FIRST VIEWPORT: ultramarine page head (7:5) with the page title in headline Anybody and one plain line; under it a bright-stock sheet holding the ruled form, labels above fields, primary pill action, secondary links as a ruled foot. Right column carries the box-office notes (what happens next, safety facts) as a ruled list.
FORM: box office counter inside the programme book; dealt lead of the surface roll; seed:2d1c5aff307d2b337a0b4181a7dcbb23.
Signature interaction: active sessions printed as a ruled schedule (time numeral column, device, place, end action) with the current session marked by the live lime pill; the 2FA setup is a numbered three-step sequence in the margin column like Publicar.

## Unresolved
- Email delivery (verification, reset links) once a provider exists.
