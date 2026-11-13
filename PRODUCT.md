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

- Real today: accounts (own auth on MongoDB, with two-step verification and recovery codes), the shelf (save games, follow creators), project drafts, and file storage on MinIO (S3): builds up to 3 GB per file sent straight from the browser in parallel parts, and browser builds (Unity, Godot, Unreal 4 HTML5, Construct, GameMaker, Defold, PICO-8, HTML5) extracted in the browser and served straight from MinIO in an isolated iframe, so Vercel never carries game bytes. Not yet: publishing a draft to the public programme (files and the playable are an owner-only preview), payments. Unreal 5 has no browser export; its builds are downloads. Forms must not pretend to complete a payment or publication.
- Platform categories: Web (HTML5), Windows, macOS, Linux, Android.
- Pricing models: free, paid with a fixed price, pay-what-you-want with an optional minimum.
- Undecided: platform fee or revenue split, payment provider, moderation policy.

## Brand Commitments

- Product name: **VibeGames** (renamed from openitch by the owner). The wordmark is set lowercase, "vibe" in the field colour and "games" in lime on ultramarine and ink. No logo exists yet. Internal identifiers (database name, auth key salt, cookie and event names, repository) keep "openitch" so existing accounts keep working.
- Must stay visually and verbally distinct from existing storefronts; no borrowed logos, layouts, or trade dress.

## Evidence on Hand

None. There are no published games, creators, statistics, testimonials, or press yet. The owner ordered all demonstration content removed: the catalogue, jams, diary and collections start empty, and every surface shows an honest empty state that points to the next step. Never invent games, people, counts, revenue, or download numbers to fill a surface.

## Product Principles

1. The game leads: every surface makes it faster to see, understand, and play a game.
2. Creators keep control: price, page, and files are theirs to set, and the tools say plainly what will happen.
3. Small and strange are first-class: discovery rewards new and unusual work, not only what already sells.
4. Honest by default: no dark patterns in pricing, no invented social proof.

## Accessibility & Inclusion

WCAG 2.2 AA as the baseline *(inferred)*; full keyboard navigation; respects `prefers-reduced-motion`; Portuguese-first copy with room for English *(inferred from the owner writing in Portuguese)*.
