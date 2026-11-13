// Synthetic programme collections: themed blocks of the sample catalogue,
// like the blocks of a festival programme. Every title, intro and note is
// demonstration material. Each note only states what the game's own page
// states (session, controls, platforms, accessibility, description).
//
// House rules for the sample data:
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

export const COLECOES: Colecao[] = [
  {
    slug: "um-botao-so",
    title: "Um botão só",
    intro:
      "Jogos inteiros que cabem num clique, num toque ou numa tecla qualquer. Servem para quem está com uma mão ocupada, para quem joga com um interruptor e para quem nunca decorou um controle.",
    curator: null,
    track: "navegador",
    items: [
      {
        game: "orbita",
        note: "Trocar de órbita é a única coisa que você faz, e a partida dura menos de um minuto. Roda aqui na página, sem instalar.",
      },
      {
        game: "canoa",
        note: "Um toque troca o lado do remo. Funciona com interruptor, espaço ou toque na tela, e a correnteza vai de 50% a 150% da velocidade.",
      },
      {
        game: "jangada",
        note: "Segurar abre a vela, soltar recolhe. Qualquer tecla serve, e o estúdio marca o jogo como jogável com uma mão.",
      },
      {
        game: "toada",
        note: "Toque curto é batida seca, toque longo é batida aberta. Não tem fim de jogo: quando você perde o compasso, o tambor espera.",
      },
      {
        game: "bonecao",
        note: "Cada toque é um passo de um boneco gigante de carnaval, ladeira de Olinda acima. Partidas de um minuto e meio.",
      },
      {
        game: "balanco",
        note: "Impulso na hora certa e mais nada. A tecla P liga o modo professor, opcional, que desenha o gráfico de energia.",
      },
    ],
  },
  {
    slug: "para-jogar-no-onibus",
    title: "Para jogar no ônibus",
    intro:
      "Escolhi pensando no trajeto entre a faculdade e o estágio. Tudo aqui roda no celular, se joga com o polegar e cabe entre um ponto e outro.",
    curator: "nanda-oliveira",
    track: "experimental",
    items: [
      {
        game: "mare-baixa",
        note: "Dez minutos por maré, e a maré é a de verdade: a tábua de Belém. Quando a água sobe, o jogo manda você para casa, que costuma ser a hora de descer.",
      },
      {
        game: "jardim-de-bolso",
        note: "Cinco minutos por dia. O jardim cresce no tempo real do telefone, então a viagem de amanhã encontra outra planta.",
      },
      {
        game: "toada",
        note: "Uma tecla ou um toque, e a toada acelera a cada volta. Leve fone: o tambor foi gravado numa sala em São Luís.",
      },
      {
        game: "andada",
        note: "Toque num carro e ele para; arraste no mangue e abre caminho. São três luas como capítulos, uma por viagem se o trajeto for longo.",
      },
    ],
  },
  {
    slug: "historias-que-cabem-num-cafe",
    title: "Histórias que cabem num café",
    intro:
      "Ficção para ler e jogar em mais ou menos meia hora, o tempo de um café passado sem pressa. Todas começam e terminam na mesma sentada.",
    curator: "quintal-games",
    track: "narrativo",
    items: [
      {
        game: "querida-vizinha",
        note: "Bilhetes na porta do 302, e cada resposta muda o tom do próximo. São 4.800 palavras, uns vinte minutos, e funciona com leitor de tela.",
      },
      {
        game: "carta-para-ninguem",
        note: "Você escreve para um endereço que não existe. Quem responde, e quando, depende do que você escreveu. Cerca de meia hora.",
      },
      {
        game: "carta-ao-eu-de-2036",
        note: "Doze alunos escreveram um dia cada da última semana de aula, e a carta final junta trechos de todos. Uns 35 minutos.",
      },
      {
        game: "neblina-1987",
        note: "A única fora da trilha Narrativo: terror de estrada, quarenta minutos de serra de madrugada. Tem sustos, e as luzes piscando podem ser desligadas.",
      },
    ],
  },
  {
    slug: "sem-relogio-correndo",
    title: "Sem relógio correndo",
    intro:
      "Pesquiso acessibilidade em jogos, e prazo curto é uma barreira que quase nunca aparece na lista de recursos. Cada um destes diz, na própria página, que não corre contra você.",
    curator: "gaia-ferraz",
    track: "puzzle",
    items: [
      {
        game: "tecela",
        note: "Sessenta fases de tear sem limite de tempo, com desfazer ilimitado e uma paleta para daltonismo.",
      },
      {
        game: "sopa-de-letras-infinita",
        note: "Sem relógio e sem pontuação, só a próxima palavra. A grade cresce enquanto você procura, em três línguas.",
      },
      {
        game: "biblioteca-22h",
        note: "Furtividade sem cronômetro: o perigo é o barulho dos passos, desenhado na tela, e não o tempo. Nenhuma informação depende de som.",
      },
      {
        game: "estilingue-lunar",
        note: "Você escolhe força e ângulo e pode deixar a trajetória prevista sempre visível. A tecla Z desfaz o último lançamento.",
      },
      {
        game: "jangada",
        note: "As três viagens de pesca não têm limite de tempo, e qualquer tecla abre a vela. Dá para jogar com uma mão.",
      },
    ],
  },
  {
    slug: "beira-dagua",
    title: "Beira d’água",
    intro:
      "Moro de frente para o mar e reparo quando um jogo sabe desenhar água. Rio na cheia, ilha sem navios, cidade debaixo da represa, sarjeta e telhado furado.",
    curator: "teo-okafor",
    track: "acao",
    items: [
      {
        game: "canoa",
        note: "O igapó na cheia, com redes esticadas entre os troncos e um boto que às vezes ajuda. Nada no percurso pune quem demora.",
      },
      {
        game: "faroleiro",
        note: "Três invernos numa ilha sem navios, consertando um farol que ninguém mais usa. Cerca de duas horas e três finais.",
      },
      {
        game: "cidade-submersa",
        note: "Uma cidade que a represa engoliu em 1974, explorada em mergulhos. O ar acaba, e a página avisa: espaços fechados debaixo d’água.",
      },
      {
        game: "barco-de-papel",
        note: "A sarjeta depois da chuva, de bueiro em bueiro. A água sobe enquanto você navega, e o barco não pode molhar demais.",
      },
      {
        game: "facho",
        note: "Espelhos levando a luz de um farol até cada barco. Quarenta e oito fases e dicas em três níveis que nunca entregam a solução de uma vez.",
      },
      {
        game: "goteira",
        note: "Aqui a água entra pelo telhado. Três baldes, três vidas e o som de chuva gravado numa varanda.",
      },
    ],
  },
  {
    slug: "estranhos-e-bonitos",
    title: "Estranhos e bonitos",
    intro:
      "Coisas que a gente não sabe em que gaveta pôr e que ficaram na cabeça depois de fechar a janela. Uma almofada de renda, uma orquestra de sucata, uma boca sem som, uma chuva que pinta e uma ladeira.",
    curator: "lucia-ramos",
    track: "experimental",
    items: [
      {
        game: "renda-de-bilro",
        note: "A renda da Lagoa da Conceição aparecendo devagar sobre o papelão furado. Não há fase nem pontuação, e dá para salvar o que fez como imagem.",
      },
      {
        game: "ferro-velho-orquestra",
        note: "Latas, molas e calotas numa esteira, e o ritmo que elas fazem juntas. Não tem uma palavra de texto.",
      },
      {
        game: "leitura-labial",
        note: "Uma boca em seis formatos dizendo pastel e caldo de cana sem som. É um quebra-cabeça de palavras e também um retrato de feira.",
      },
      {
        game: "chuva-de-pixels",
        note: "Cada gota que cai na batida deixa uma cor no asfalto. Uns dez minutos, sem texto, e roda na página.",
      },
      {
        game: "bicicletaria",
        note: "Quadro torto, roda de carrinho de mão, correia de máquina de costura. A ladeira é a da rua da escola, medida com trena.",
      },
    ],
  },
  {
    slug: "sem-acordar-a-casa",
    title: "Para jogar sem acordar a casa",
    intro:
      "Faço quebra-cabeças depois que todo mundo dorme, então sei o valor de um jogo que dispensa o som. Estes dizem na página que nada depende do áudio, ou nem têm áudio.",
    curator: "bruno-iwata",
    track: "puzzle",
    items: [
      {
        game: "biblioteca-22h",
        note: "Não tem som nenhum: cada passo vira um anel desenhado na tela. Vinte e quatro salas para atravessar em silêncio, como quem chega tarde.",
      },
      {
        game: "quarto-404",
        note: "Um escape room de uma tela feito em 48 horas para a Mini Jam Silêncio. Sem som, só com o que você vê, em uns quinze minutos.",
      },
      {
        game: "leitura-labial",
        note: "A boca diz a palavra sem som, quantas vezes você quiser. Quando você erra, o jogo mostra quais formatos de boca confundiu.",
      },
      {
        game: "orbita",
        note: "Nenhuma informação depende de som, e a partida dura um minuto. Para a última antes de apagar a luz.",
      },
    ],
  },
  {
    slug: "fisica-que-da-para-sentir",
    title: "Física que dá para sentir",
    intro:
      "Pêndulo, gravidade, atrito e um pombo com pressa. Jogos em que a física não é cenário: é o que você aprende a prever com as mãos.",
    curator: null,
    track: "navegador",
    items: [
      {
        game: "balanco",
        note: "Física de pêndulo de verdade: impulso no ponto mais alto rende, fora de hora freia. Feito por um professor de física num feriado.",
      },
      {
        game: "estilingue-lunar",
        note: "Você só escolhe força e ângulo; as luas fazem a curva. Cada fase termina com uma nota sobre a física, escrita para o ensino médio.",
      },
      {
        game: "bicicletaria",
        note: "Monte com o que sobrou e empurre ladeira abaixo. A inclinação foi medida com trena e com o acelerômetro de um celular.",
      },
      {
        game: "bonecao",
        note: "O corpo de pano balança e a cabeça pesa. Cada toque é um passo, e o equilíbrio fica por sua conta.",
      },
      {
        game: "pombo-correio-simulador",
        note: "Física boba, de propósito: um pombo com prazo de entrega, janelas no caminho e migalhas como pagamento.",
      },
    ],
  },
];

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

/** Sanity check for the sample data (used by development scripts, not by pages). */
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
