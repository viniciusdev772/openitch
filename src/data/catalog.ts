// Synthetic sample catalogue. Every game, creator, jam and number here is
// invented demonstration material; the UI labels it as such.

export type TrackId = "navegador" | "acao" | "narrativo" | "puzzle" | "experimental";
export type Platform = "web" | "windows" | "macos" | "linux" | "android";
export type CoverStyle =
  | "orbit"
  | "beam"
  | "letters"
  | "depths"
  | "rain"
  | "envelope"
  | "pigeon"
  | "fog"
  | "garden"
  | "weave"
  | "door"
  | "boat"
  | "scrap"
  | "bus"
  | "golem"
  | "tide";

export type Price =
  | { kind: "free" }
  | { kind: "fixed"; amount: number }
  | { kind: "pwyw"; minimum: number };

export interface Track {
  id: TrackId;
  name: string;
  short: string;
  blurb: string;
  /** CSS custom property name for the track's spot colour */
  color: string;
  /** Text colour that holds contrast on the field */
  on: string;
}

export interface Creator {
  slug: string;
  name: string;
  city: string;
  bio: string;
}

export interface Download {
  platform: Platform;
  file: string;
  size: string;
}

export interface Game {
  slug: string;
  number: number;
  title: string;
  tagline: string;
  description: string[];
  creator: string;
  track: TrackId;
  tags: string[];
  platforms: Platform[];
  price: Price;
  /** ISO timestamp of publication */
  published: string;
  updated: string;
  session: string;
  languages: string[];
  cover: CoverStyle;
  /** Cover palette: [ground, figure, accent] as CSS vars */
  palette: [string, string, string];
  playable?: "orbita";
  downloads: Download[];
  jam?: string;
}

export interface Jam {
  slug: string;
  title: string;
  theme: string;
  host: string;
  start: string;
  end: string;
  entries: number;
  track: TrackId;
  summary: string;
}

export const TRACKS: Track[] = [
  {
    id: "navegador",
    name: "Navegador",
    short: "Joga na página",
    blurb: "Builds HTML5 que rodam direto aqui, sem instalar nada.",
    color: "--lime",
    on: "--ink",
  },
  {
    id: "acao",
    name: "Ação",
    short: "Reflexo e ritmo",
    blurb: "Corrida, plataforma, roguelike e tudo que pede dedo rápido.",
    color: "--tangerine",
    on: "--ink",
  },
  {
    id: "narrativo",
    name: "Narrativo",
    short: "Histórias para ler e jogar",
    blurb: "Ficção interativa, cartas, viagens curtas e personagens que ficam.",
    color: "--magenta",
    on: "--ink",
  },
  {
    id: "puzzle",
    name: "Quebra-cabeça",
    short: "Uma ideia por fase",
    blurb: "Lógica, palavras, padrões e o prazer do clique certo.",
    color: "--teal",
    on: "--ink",
  },
  {
    id: "experimental",
    name: "Experimental",
    short: "Fora de qualquer gaveta",
    blurb: "Brinquedos, instrumentos e coisas que ainda não têm nome.",
    color: "--ultra",
    on: "--paper",
  },
];

export const PLATFORMS: Record<Platform, { code: string; name: string }> = {
  web: { code: "N", name: "Navegador" },
  windows: { code: "W", name: "Windows" },
  macos: { code: "M", name: "macOS" },
  linux: { code: "L", name: "Linux" },
  android: { code: "A", name: "Android" },
};

export const CREATORS: Creator[] = [
  { slug: "estudio-mare", name: "Estúdio Maré", city: "Recife", bio: "Duas pessoas, um barco emprestado e jogos de um botão só." },
  { slug: "ana-torquato", name: "Ana Torquato", city: "Belo Horizonte", bio: "Escreve ficção interativa sobre lugares que estão sumindo." },
  { slug: "coletivo-fuba", name: "Coletivo Fubá", city: "São Paulo", bio: "Coletivo de seis pessoas que faz jogos em fins de semana longos." },
  { slug: "bruno-iwata", name: "Bruno Iwata", city: "Curitiba", bio: "Programador de dia, autor de quebra-cabeças à noite." },
  { slug: "pixelcaju", name: "pixelcaju", city: "Fortaleza", bio: "Pixel art, trilha própria e um gosto por coisas pequenas." },
  { slug: "lucia-ramos", name: "Lúcia & Ramos", city: "Porto Alegre", bio: "Dupla de ilustração e código. Gostam de neblina e de silêncio." },
  { slug: "quintal-games", name: "Quintal Games", city: "Belém", bio: "Jogos de quintal: plantar, pescar, esperar a chuva." },
  { slug: "teo-okafor", name: "Teo Okafor", city: "Salvador", bio: "Faz instrumentos que também são jogos, e vice-versa." },
];

export const GAMES: Game[] = [
  {
    slug: "orbita",
    number: 1,
    title: "Órbita",
    tagline: "Um botão. Duas órbitas. Quantas estrelas cabem numa volta?",
    description: [
      "Você é uma lua pequena presa a um planeta teimoso. Clique, toque ou aperte espaço para saltar entre a órbita de dentro e a de fora, recolher estrelas e desviar dos detritos.",
      "Cada volta completa acelera o giro. Uma partida dura menos de um minuto e você vai querer outra.",
    ],
    creator: "estudio-mare",
    track: "navegador",
    tags: ["um botão", "arcade", "curto"],
    platforms: ["web"],
    price: { kind: "free" },
    published: "2026-11-12T14:32:00-03:00",
    updated: "2026-11-12T14:32:00-03:00",
    session: "1 min por partida",
    languages: ["Português", "English"],
    cover: "orbit",
    palette: ["--ultra", "--lime", "--paper"],
    playable: "orbita",
    downloads: [],
  },
  {
    slug: "faroleiro",
    number: 2,
    title: "Faroleiro",
    tagline: "Três invernos cuidando de uma luz que ninguém mais usa.",
    description: [
      "Um jogo narrativo sobre a última pessoa a manter um farol aceso numa ilha sem navios. Conserte o mecanismo, responda cartas antigas e decida quando apagar.",
      "Cerca de duas horas, com três finais.",
    ],
    creator: "ana-torquato",
    track: "narrativo",
    tags: ["solidão", "cartas", "mar"],
    platforms: ["windows", "macos", "linux"],
    price: { kind: "pwyw", minimum: 5 },
    published: "2026-11-12T11:05:00-03:00",
    updated: "2026-11-12T11:05:00-03:00",
    session: "cerca de 2 h",
    languages: ["Português"],
    cover: "beam",
    palette: ["--ink", "--tangerine", "--paper"],
    downloads: [
      { platform: "windows", file: "faroleiro-win-1.0.zip", size: "212 MB" },
      { platform: "macos", file: "faroleiro-mac-1.0.dmg", size: "220 MB" },
      { platform: "linux", file: "faroleiro-linux-1.0.tar.gz", size: "208 MB" },
    ],
  },
  {
    slug: "sopa-de-letras-infinita",
    number: 3,
    title: "Sopa de Letras Infinita",
    tagline: "O caça-palavras que cresce enquanto você procura.",
    description: [
      "A grade nunca termina: cada palavra encontrada abre uma nova região. Sem relógio, sem pontuação, só a próxima palavra.",
    ],
    creator: "bruno-iwata",
    track: "puzzle",
    tags: ["palavras", "relaxante", "infinito"],
    platforms: ["web"],
    price: { kind: "free" },
    published: "2026-11-12T09:48:00-03:00",
    updated: "2026-11-12T09:48:00-03:00",
    session: "quanto quiser",
    languages: ["Português", "English", "Español"],
    cover: "letters",
    palette: ["--teal", "--ink", "--paper"],
    downloads: [],
  },
  {
    slug: "cidade-submersa",
    number: 4,
    title: "Cidade Submersa",
    tagline: "Mergulhe numa cidade que o rio engoliu em 1974.",
    description: [
      "Exploração em primeira pessoa por uma cidade inundada por uma represa. Encontre objetos, monte a história de quem morava ali e volte à superfície antes do ar acabar.",
    ],
    creator: "coletivo-fuba",
    track: "narrativo",
    tags: ["exploração", "memória", "água"],
    platforms: ["windows", "macos"],
    price: { kind: "fixed", amount: 24 },
    published: "2026-11-11T19:20:00-03:00",
    updated: "2026-11-12T08:02:00-03:00",
    session: "cerca de 4 h",
    languages: ["Português", "English"],
    cover: "depths",
    palette: ["--teal", "--ultra", "--paper"],
    downloads: [
      { platform: "windows", file: "cidade-submersa-win.zip", size: "1,4 GB" },
      { platform: "macos", file: "cidade-submersa-mac.dmg", size: "1,5 GB" },
    ],
  },
  {
    slug: "neblina-1987",
    number: 5,
    title: "Neblina 1987",
    tagline: "Uma fita VHS, uma estrada de serra e algo no acostamento.",
    description: [
      "Terror curto em baixa resolução. Dirija de madrugada pela serra, pare quando precisar e não olhe demais pelo retrovisor.",
    ],
    creator: "lucia-ramos",
    track: "acao",
    tags: ["terror", "estrada", "curto"],
    platforms: ["windows"],
    price: { kind: "fixed", amount: 12 },
    published: "2026-11-11T22:10:00-03:00",
    updated: "2026-11-11T22:10:00-03:00",
    session: "cerca de 40 min",
    languages: ["Português", "English"],
    cover: "fog",
    palette: ["--ink", "--magenta", "--paper"],
    downloads: [{ platform: "windows", file: "neblina1987.zip", size: "340 MB" }],
  },
  {
    slug: "carta-para-ninguem",
    number: 6,
    title: "Carta para Ninguém",
    tagline: "Escreva para um endereço que não existe e espere a resposta.",
    description: [
      "Ficção interativa em forma de correspondência. Cada carta que você escreve muda quem responde, e quando.",
    ],
    creator: "ana-torquato",
    track: "narrativo",
    tags: ["ficção interativa", "cartas", "texto"],
    platforms: ["web"],
    price: { kind: "pwyw", minimum: 0 },
    published: "2026-11-10T16:40:00-03:00",
    updated: "2026-11-11T10:00:00-03:00",
    session: "cerca de 30 min",
    languages: ["Português"],
    cover: "envelope",
    palette: ["--magenta", "--ink", "--paper"],
    downloads: [],
  },
  {
    slug: "pombo-correio-simulador",
    number: 7,
    title: "Pombo Correio Simulador",
    tagline: "Entregue mensagens. Evite janelas. Aceite migalhas.",
    description: [
      "Um jogo de física bobo sobre ser um pombo com prazo de entrega no centro da cidade.",
    ],
    creator: "pixelcaju",
    track: "acao",
    tags: ["comédia", "física", "cidade"],
    platforms: ["web", "windows"],
    price: { kind: "free" },
    published: "2026-11-10T13:15:00-03:00",
    updated: "2026-11-10T13:15:00-03:00",
    session: "cerca de 20 min",
    languages: ["Português", "English"],
    cover: "pigeon",
    palette: ["--tangerine", "--ink", "--paper"],
    downloads: [{ platform: "windows", file: "pombo-correio.zip", size: "88 MB" }],
  },
  {
    slug: "jardim-de-bolso",
    number: 8,
    title: "Jardim de Bolso",
    tagline: "Um vaso, uma janela e sete estações para cuidar.",
    description: [
      "Plante, regue e espere. O jardim cresce no tempo real do seu telefone e muda com o clima lá fora.",
    ],
    creator: "quintal-games",
    track: "experimental",
    tags: ["aconchegante", "plantas", "tempo real"],
    platforms: ["android", "web"],
    price: { kind: "free" },
    published: "2026-11-09T08:00:00-03:00",
    updated: "2026-11-11T07:30:00-03:00",
    session: "5 min por dia",
    languages: ["Português", "English"],
    cover: "garden",
    palette: ["--lime", "--teal", "--ink"],
    downloads: [{ platform: "android", file: "jardim-de-bolso.apk", size: "46 MB" }],
  },
  {
    slug: "tecela",
    number: 9,
    title: "Tecelã",
    tagline: "Quebra-cabeças de tear: cruze os fios, revele o desenho.",
    description: [
      "Sessenta fases construídas sobre a lógica de um tear manual. Cada fio que passa por cima ou por baixo muda o padrão inteiro.",
    ],
    creator: "bruno-iwata",
    track: "puzzle",
    tags: ["lógica", "padrões", "artesanato"],
    platforms: ["windows", "macos", "linux"],
    price: { kind: "fixed", amount: 18 },
    published: "2026-11-08T18:30:00-03:00",
    updated: "2026-11-10T21:00:00-03:00",
    session: "cerca de 6 h",
    languages: ["Português", "English", "日本語"],
    cover: "weave",
    palette: ["--paper", "--magenta", "--ultra"],
    downloads: [
      { platform: "windows", file: "tecela-win.zip", size: "96 MB" },
      { platform: "macos", file: "tecela-mac.zip", size: "102 MB" },
      { platform: "linux", file: "tecela-linux.tar.gz", size: "94 MB" },
    ],
  },
  {
    slug: "quarto-404",
    number: 10,
    title: "Quarto 404",
    tagline: "Escape de um quarto de hotel que não está no mapa.",
    description: [
      "Feito em 48 horas para a Mini Jam Silêncio. Um escape room de uma tela, sem som, só com o que você vê.",
    ],
    creator: "coletivo-fuba",
    track: "puzzle",
    tags: ["escape room", "jam", "curto"],
    platforms: ["web"],
    price: { kind: "free" },
    published: "2026-11-08T23:58:00-03:00",
    updated: "2026-11-08T23:58:00-03:00",
    session: "cerca de 15 min",
    languages: ["Português"],
    cover: "door",
    palette: ["--tangerine", "--ultra", "--paper"],
    downloads: [],
    jam: "mini-jam-silencio",
  },
  {
    slug: "barco-de-papel",
    number: 11,
    title: "Barco de Papel",
    tagline: "Desça a sarjeta depois da chuva sem deixar o barco molhar demais.",
    description: [
      "Plataforma de rolagem lateral em que a água sobe enquanto você navega por bueiros, folhas e tampinhas.",
    ],
    creator: "estudio-mare",
    track: "acao",
    tags: ["plataforma", "chuva", "pixel art"],
    platforms: ["web", "windows"],
    price: { kind: "pwyw", minimum: 3 },
    published: "2026-11-07T15:00:00-03:00",
    updated: "2026-11-09T12:00:00-03:00",
    session: "cerca de 1 h",
    languages: ["Português", "English"],
    cover: "boat",
    palette: ["--ultra", "--paper", "--tangerine"],
    downloads: [{ platform: "windows", file: "barco-de-papel.zip", size: "64 MB" }],
  },
  {
    slug: "ferro-velho-orquestra",
    number: 12,
    title: "Ferro-Velho Orquestra",
    tagline: "Monte uma banda com o que sobrou no galpão.",
    description: [
      "Um brinquedo musical: arraste latas, molas e calotas para a esteira e ouça o ritmo que elas fazem juntas.",
    ],
    creator: "teo-okafor",
    track: "experimental",
    tags: ["música", "brinquedo", "sandbox"],
    platforms: ["web"],
    price: { kind: "free" },
    published: "2026-11-06T20:00:00-03:00",
    updated: "2026-11-06T20:00:00-03:00",
    session: "quanto quiser",
    languages: ["sem texto"],
    cover: "scrap",
    palette: ["--tangerine", "--ink", "--lime"],
    downloads: [],
  },
  {
    slug: "ultimos-onibus",
    number: 13,
    title: "Últimos Ônibus",
    tagline: "Cinco linhas noturnas, cinco passageiros, uma madrugada.",
    description: [
      "Antologia narrativa em que você dirige o último ônibus de cada linha e escuta quem sobe.",
    ],
    creator: "lucia-ramos",
    track: "narrativo",
    tags: ["antologia", "noite", "cidade"],
    platforms: ["windows", "macos"],
    price: { kind: "fixed", amount: 9 },
    published: "2026-11-05T21:45:00-03:00",
    updated: "2026-11-05T21:45:00-03:00",
    session: "cerca de 90 min",
    languages: ["Português", "English"],
    cover: "bus",
    palette: ["--magenta", "--ultra", "--lime"],
    downloads: [
      { platform: "windows", file: "ultimos-onibus-win.zip", size: "410 MB" },
      { platform: "macos", file: "ultimos-onibus-mac.dmg", size: "418 MB" },
    ],
  },
  {
    slug: "golem-de-bolso",
    number: 14,
    title: "Golem de Bolso",
    tagline: "Um roguelike em que seu golem é feito do que você pisa.",
    description: [
      "Cada sala dá um material novo: barro, cobre, vidro, musgo. O golem herda as forças e as fraquezas de cada um.",
    ],
    creator: "pixelcaju",
    track: "acao",
    tags: ["roguelike", "crafting", "pixel art"],
    platforms: ["windows", "linux"],
    price: { kind: "fixed", amount: 20 },
    published: "2026-11-04T17:00:00-03:00",
    updated: "2026-11-10T09:15:00-03:00",
    session: "partidas de 30 min",
    languages: ["Português", "English"],
    cover: "golem",
    palette: ["--lime", "--ink", "--tangerine"],
    downloads: [
      { platform: "windows", file: "golem-de-bolso-win.zip", size: "150 MB" },
      { platform: "linux", file: "golem-de-bolso-linux.tar.gz", size: "148 MB" },
    ],
  },
  {
    slug: "mare-baixa",
    number: 15,
    title: "Maré Baixa",
    tagline: "Pesque na beira do mangue enquanto a maré deixa.",
    description: [
      "Jogo de pesca tranquilo com a tábua de marés real de Belém. Quando a água sobe, é hora de ir para casa.",
    ],
    creator: "quintal-games",
    track: "experimental",
    tags: ["pesca", "aconchegante", "mangue"],
    platforms: ["android"],
    price: { kind: "free" },
    published: "2026-11-03T06:30:00-03:00",
    updated: "2026-11-03T06:30:00-03:00",
    session: "10 min por maré",
    languages: ["Português"],
    cover: "tide",
    palette: ["--teal", "--lime", "--ink"],
    downloads: [{ platform: "android", file: "mare-baixa.apk", size: "38 MB" }],
  },
  {
    slug: "chuva-de-pixels",
    number: 16,
    title: "Chuva de Pixels",
    tagline: "Pinte a cidade com a chuva antes que o sol seque tudo.",
    description: [
      "Um jogo de ritmo e pintura: cada gota que cai na batida deixa uma cor no asfalto.",
    ],
    creator: "teo-okafor",
    track: "navegador",
    tags: ["ritmo", "pintura", "curto"],
    platforms: ["web"],
    price: { kind: "pwyw", minimum: 0 },
    published: "2026-11-12T07:15:00-03:00",
    updated: "2026-11-12T07:15:00-03:00",
    session: "cerca de 10 min",
    languages: ["sem texto"],
    cover: "rain",
    palette: ["--lime", "--ultra", "--magenta"],
    downloads: [],
  },
];

export const JAMS: Jam[] = [
  {
    slug: "mini-jam-silencio",
    title: "Mini Jam Silêncio",
    theme: "Silêncio",
    host: "Coletivo Fubá",
    start: "2026-11-06T19:00:00-03:00",
    end: "2026-11-08T23:59:00-03:00",
    entries: 41,
    track: "puzzle",
    summary: "48 horas, nenhum som permitido. O jogo precisa funcionar no mudo.",
  },
  {
    slug: "jam-do-feriado",
    title: "Jam do Feriado",
    theme: "Ponte",
    host: "Estúdio Maré",
    start: "2026-11-13T18:00:00-03:00",
    end: "2026-11-16T23:59:00-03:00",
    entries: 0,
    track: "acao",
    summary: "Quatro dias de feriado prolongado. Tema anunciado na abertura: Ponte.",
  },
  {
    slug: "jam-acessivel",
    title: "Jam Acessível",
    theme: "Jogue com uma mão",
    host: "Quintal Games",
    start: "2026-11-01T00:00:00-03:00",
    end: "2026-11-30T23:59:00-03:00",
    entries: 23,
    track: "experimental",
    summary: "Um mês para fazer um jogo inteiro jogável com uma mão só.",
  },
  {
    slug: "jam-de-texto",
    title: "Jam de Texto Corrido",
    theme: "Uma carta",
    host: "Ana Torquato",
    start: "2026-11-10T00:00:00-03:00",
    end: "2026-11-20T23:59:00-03:00",
    entries: 12,
    track: "narrativo",
    summary: "Ficção interativa com até 5 mil palavras. Ferramentas livres.",
  },
  {
    slug: "jam-navegador",
    title: "Jam 13 KB",
    theme: "Cabe no bolso",
    host: "Bruno Iwata",
    start: "2026-11-22T00:00:00-03:00",
    end: "2026-12-06T23:59:00-03:00",
    entries: 0,
    track: "navegador",
    summary: "O jogo inteiro, zipado, precisa ter menos de 13 KB e rodar no navegador.",
  },
];

export const trackById = (id: TrackId) => TRACKS.find((t) => t.id === id)!;
export const creatorBySlug = (slug: string) => CREATORS.find((c) => c.slug === slug);
export const gameBySlug = (slug: string) => GAMES.find((g) => g.slug === slug);
export const gamesByNewest = () =>
  [...GAMES].sort((a, b) => +new Date(b.published) - +new Date(a.published));

export function formatPrice(price: Price): string {
  switch (price.kind) {
    case "free":
      return "Grátis";
    case "fixed":
      return `R$ ${price.amount.toFixed(2).replace(".", ",")}`;
    case "pwyw":
      return price.minimum > 0
        ? `Pague o que quiser · mín. R$ ${price.minimum}`
        : "Pague o que quiser";
  }
}

export function shortPrice(price: Price): string {
  switch (price.kind) {
    case "free":
      return "Grátis";
    case "fixed":
      return `R$ ${price.amount}`;
    case "pwyw":
      return price.minimum > 0 ? `R$ ${price.minimum}+` : "Livre";
  }
}

export const entryNumber = (n: number) => `Nº ${String(n).padStart(4, "0")}`;

const TZ = "America/Sao_Paulo";

export function formatTime(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: TZ }).format(new Date(iso));
}

export function formatDay(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: TZ })
    .format(new Date(iso))
    .replace(".", "");
}

export function formatDate(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric", timeZone: TZ }).format(new Date(iso));
}
