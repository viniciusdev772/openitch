// Programme collections: themed blocks of the catalogue, like the blocks of a
// festival programme. Each note only states what the game's own page states
// (session, controls, platforms, accessibility, description). Empty for now.
//
// House rules:
// - a block signed by a creator never includes that creator's own games;
//   blocks that do are signed by the programme team (curator: null);
// - a block's track is the most frequent track among its games.

import { GAMES, creatorBySlug, gameBySlug, type Creator, type Game, type TrackId } from "./catalog";

export interface ColecaoItem {
  /** Game slug from the catalogue */
  game: string;
  /** Why the game is in the block, in the curator's voice */
  note: string;
}

export interface Colecao {
  slug: string;
  title: string;
  /** Short presentation, in the curator's voice */
  intro: string;
  /** Creator slug of the curator, or null for the programme team */
  curator: string | null;
  track: TrackId;
  /** Running order */
  items: ColecaoItem[];
}

export const TEAM_NAME = "Equipe do programa";

export const COLECOES: Colecao[] = [];

export const colecaoBySlug = (slug: string) => COLECOES.find((c) => c.slug === slug);

/** Position of a block in the programme, from 1. */
export const colecaoNumber = (c: Colecao) => COLECOES.indexOf(c) + 1;

export interface ColecaoEntry {
  game: Game;
  note: string;
}

/** The running order with each game resolved; slugs missing from the catalogue are skipped. */
export function colecaoEntries(c: Colecao): ColecaoEntry[] {
  return c.items.flatMap((item) => {
    const game = gameBySlug(item.game);
    return game ? [{ game, note: item.note }] : [];
  });
}

export type Curator = { kind: "team"; name: string } | { kind: "creator"; name: string; creator: Creator };

export function colecaoCurator(c: Colecao): Curator {
  const creator = c.curator ? creatorBySlug(c.curator) : undefined;
  return creator ? { kind: "creator", name: creator.name, creator } : { kind: "team", name: TEAM_NAME };
}

/** Blocks a game appears in. */
export const colecoesWithGame = (slug: string) => COLECOES.filter((c) => c.items.some((i) => i.game === slug));

/** Sanity check for the collections data (used by development scripts, not by pages). */
export function colecaoProblems(): string[] {
  const problems: string[] = [];
  for (const c of COLECOES) {
    for (const i of c.items) if (!gameBySlug(i.game)) problems.push(`${c.slug}: jogo desconhecido ${i.game}`);
    if (c.curator && !creatorBySlug(c.curator)) problems.push(`${c.slug}: curadoria desconhecida ${c.curator}`);
    const games = colecaoEntries(c).map((e) => e.game);
    if (c.curator && games.some((g) => g.creator === c.curator)) problems.push(`${c.slug}: inclui jogo de quem assina`);
    const counts = new Map<TrackId, number>();
    for (const g of games) counts.set(g.track, (counts.get(g.track) ?? 0) + 1);
    const top = Math.max(...counts.values());
    if ((counts.get(c.track) ?? 0) < top) problems.push(`${c.slug}: trilha ${c.track} não é a mais frequente`);
  }
  if (new Set(COLECOES.map((c) => c.slug)).size !== COLECOES.length) problems.push("slugs repetidos");
  if (GAMES.length === 0) problems.push("catálogo vazio");
  return problems;
}
