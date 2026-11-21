# Product

<!-- impeccable:product-schema 1 -->

> Interview substitution: the owner asked for no questions ("não me faça perguntas"). Every fact below marked *(inferred)* comes from the original brief alone: "uma nova itch.io de postar jogos e etc", built with Next.js. Confirm or correct them when convenient.

## Platform

web

## Stack

Next.js (pinned by the owner). Delegated details: App Router, TypeScript, plain CSS with custom properties (no UI kit), self-hosted fonts via `@fontsource` packages. Data is a typed in-repo seed (`src/data`) until a backend is chosen.

## Users

- **Players** *(inferred)*: people who browse independent games on a laptop or phone in the evening, looking for something small, strange, or personal to play right now, often free or pay-what-you-want, often in the browser.
- **Creators** *(inferred)*: solo developers, students, artists, and small teams who want to put a build online in minutes, set their own price (including free and pay-what-you-want), and keep control of their page.
- **Jam hosts** *(inferred)*: communities that run time-boxed game jams and need a place for entries to land.

## Product Purpose

An open storefront and publishing home for independent games: upload a build, get a page, set a price (or none), get played. Success is a creator going from zip file to a live, playable page in one sitting, and a player finding something they would never have been shown by a mainstream store. *(inferred)*

## Positioning

Open by default *(inherited from the project's first name, "openitch")*: creators set price and revenue share themselves, browser-playable builds run on the page, and discovery favours new and odd work over sales rank. Treat any specific revenue split, fee, or licensing claim as undecided until the owner states it.

## Operating Context

- Players: browse by tag, platform, price, and "new"; open a game page; play in browser or download; optionally pay what they want; follow creators.
- Creators: create a project, upload files per platform (web/zip, Windows, macOS, Linux, Android), write the page, set price and minimum, publish, read basic stats.
- Jams: a jam has a theme, a window of dates, and a list of entries.

## Capabilities and Constraints

- Real today: accounts (own auth on MongoDB, with two-step verification and recovery codes), the shelf (save games, follow creators), project drafts, and file storage on MinIO (S3): builds up to 3 GB per file sent straight from the browser in parallel parts, and browser builds (Unity, Godot, Unreal 4 HTML5, Construct, GameMaker, Defold, PICO-8, HTML5) extracted in the browser and served straight from MinIO in an isolated iframe, so Vercel never carries game bytes (one exception: importing from itch.io, below). Import from itch.io (/publicar): paste the game page URL and get a draft with title, tagline, description, platforms, price, tags, languages, details, credits, cover and up to 8 screenshots (they print in an "Imagens" strip on the game page). In step 3, "Arquivos no itch.io" lists the game's downloads and copies each one server-side through itch's public download flow (same as a visitor: page csrf token, /download_url, /file/<id>, then HTTP Range from the itch CDN into the MinIO multipart upload, with the usual size checks). No itch account or API key. Only files itch gives away without purchase come (free or pay-what-you-want); the browser (HTML5) version, which itch serves only as loose files on html(-classic).itch.zone, is rebuilt server-side by following references from its entry page (HTML attributes, CSS url(), quoted paths in JS/JSON), recognised with the same engine detection as a browser upload, written to the play bucket and registered as a normal build (checked on all nine games of one creator: five Vite/HTML5 and three Unity builds). Anyone can import any public page: the UI asks to bring only your own games. Publishing: a complete draft (title, tagline, description, at least one platform, a ready file for every platform it lists, price free) enters the public programme with a permanent entry number (Nº 0001…) and address (/jogo/<slug>); the creator gets a /criador/<slug> page; public pages read published games from MongoDB and refresh within a minute (at once on publish, edit, take-down). Take-down returns it to draft and keeps number and address. A published game stays fully editable: every field, the page details (duration, languages, controls, accessibility, content notes, credits), an uploaded cover image (PNG/JPEG/WebP up to 4 MB, checked by its first bytes, served from MinIO), files and builds (the public page refreshes at once), and its address (the old one redirects permanently, shelves follow). The owner sees an ink "Este jogo é seu" strip on the public page with Editar, Tirar do ar and Excluir; deleting removes files, builds and cover. Creators edit city and a short bio in /conta; they print on the creator page. Not yet: payments, so only free games publish (a draft may keep another price). Unreal 5 builds are downloads unless the creator exports a web build (SimplyStream, UE 5.9 Preview or a community WebGPU fork; /ajuda#unreal-web), which then uploads as a normal browser build. Windows downloads (.exe, or .zip with an .exe) can be tried in the browser, experimentally, on the player's machine: 32-bit programs in Boxedwine 26R1 (in-page iframe), 64-bit programs in Boxedwine64 (wine64, interpreted x86-64, its own cross-origin-isolated tab served from the play bucket; the server installs it once by version, ~240 MB). DirectX 10/11/12 runs in neither, so Unreal Engine builds are detected and pointed to the web export. Forms must not pretend to complete a payment. Moderation is done by AI with no human in the loop (owner's decision): anyone, with or without an account, can report a published game or creator profile ("Denunciar"; 5 per hour per network without an account, one per person per target every 30 days; anonymous reporters are kept only as an HMAC of the IP), and every publish is screened first. Three cheap OpenRouter decision models from different makers (liquid/d1.2-ultra, perplexity/pplx-decider-v1.2, typesafe/jev-1.14; under US$ 0.0002 per case) read the public page, file names, cover and up to three images, and vote; majority plus a 70% mean is a violation, and severity decides: dismissed, taken down (back to draft; the owner gets one appeal per takedown in /conta/projetos, judged by the same models, and a reversed takedown no longer counts as a strike and puts the game back; or republish after changes for a fresh review), or account banned (severe, zero-tolerance rules, or a third takedown in 180 days). A banned account loses its sessions and live games, sees the rule and each model's vote at /conta-suspensa, and gets one appeal judged by the same models (reversal restores the games). Terms of use, community rules, how moderation decides and privacy live at /termos; sign-up states acceptance. Needs OPENROUTER_API_KEY; without it reports wait in the queue and publishing is not screened.
- Platform categories: Web (HTML5), Windows, macOS, Linux, Android.
- Pricing models: free, paid with a fixed price, pay-what-you-want with an optional minimum.
- Undecided: platform fee or revenue split, payment provider, moderation policy.

## Brand Commitments

- Product name: **Portal dos Games** (renamed from VibeGames, and before that openitch; domain portaldosgames.com.br). The wordmark is set lowercase, "portal dos" in the field colour and "games" in lime on ultramarine and ink; the masthead shortens it to "portaldosgames". No logo exists yet. Internal identifiers (database name, auth key salt, cookie and event names, storage buckets, repository) keep their old names (openitch, vibegames) so existing accounts and data keep working.
- Must stay visually and verbally distinct from existing storefronts; no borrowed logos, layouts, or trade dress.

## Evidence on Hand

None beyond what creators publish themselves. There are no statistics, testimonials, or press. The owner ordered all demonstration content removed: the catalogue, jams, diary and collections start empty, and every surface shows an honest empty state that points to the next step. Never invent games, people, counts, revenue, or download numbers to fill a surface.

## Product Principles

1. The game leads: every surface makes it faster to see, understand, and play a game.
2. Creators keep control: price, page, and files are theirs to set, and the tools say plainly what will happen.
3. Small and strange are first-class: discovery rewards new and unusual work, not only what already sells.
4. Honest by default: no dark patterns in pricing, no invented social proof.

## Accessibility & Inclusion

WCAG 2.2 AA as the baseline *(inferred)*; full keyboard navigation; respects `prefers-reduced-motion`; Portuguese-first copy with room for English *(inferred from the owner writing in Portuguese)*.
