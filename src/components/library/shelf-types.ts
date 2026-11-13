/**
 * Linhas da estante já resolvidas no servidor. O cliente recebe só o que
 * imprime; o catálogo inteiro nunca entra no bundle de /estante.
 */

export interface ShelfTrack {
  name: string;
  /** Nome da custom property da cor da trilha, ex.: "--magenta". */
  color: string;
  /** Nome da custom property do texto sobre a trilha. */
  on: string;
}

export interface ShelfPlatform {
  code: string;
  name: string;
  on: boolean;
}

export interface ShelfGame {
  slug: string;
  /** Nº já com zeros: "0019". */
  number: string;
  title: string;
  tagline: string;
  creator: string;
  creatorName: string;
  track: ShelfTrack;
  /** As cinco plataformas da legenda, na ordem, com as que o jogo tem ligadas. */
  platforms: ShelfPlatform[];
  price: string;
  /** ISO 8601 */
  published: string;
}

export interface ShelfSaved {
  game: ShelfGame;
  /** ISO 8601 */
  at: string;
}

export interface ShelfPerson {
  slug: string;
  name: string;
  city: string;
  count: number;
  /** Quando passou a seguir (ISO 8601); ausente nas sugestões. */
  at?: string;
}

export interface ShelfData {
  saved: ShelfSaved[];
  following: ShelfPerson[];
  /** Quem fez o que você guardou, quando você ainda não segue ninguém. */
  suggested: ShelfPerson[];
  /** Jogos de quem você segue ou pode seguir daqui, mais novo primeiro. */
  news: ShelfGame[];
}
