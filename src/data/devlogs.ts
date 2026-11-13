// Synthetic devlogs and release notes for the sample catalogue. Every note,
// date and detail here is invented demonstration material, written for games
// that already exist in catalog.ts.

import { creatorBySlug, gameBySlug, type Game } from "./catalog";

export type DevlogKind = "lancamento" | "atualizacao" | "devlog" | "jam";

export interface Devlog {
  slug: string;
  /** Slug of a game in catalog.ts */
  game: string;
  kind: DevlogKind;
  title: string;
  /** ISO timestamp, São Paulo time */
  at: string;
  body: string[];
}

export const DEVLOG_KINDS: Record<DevlogKind, string> = {
  lancamento: "Lançamento",
  atualizacao: "Atualização",
  devlog: "Devlog",
  jam: "Jam",
};

export const DEVLOGS: Devlog[] = [
  {
    slug: "orbita-entra-no-programa",
    game: "orbita",
    kind: "lancamento",
    title: "Órbita entra no programa",
    at: "2026-11-12T14:32:00-03:00",
    body: [
      "Órbita começou como um teste de quinze minutos: quanto jogo cabe num botão só? A resposta virou uma lua pequena pulando entre duas órbitas, e a gente não conseguiu parar de jogar.",
      "A versão que entra hoje roda direto na página, sem instalar nada. Clique, toque ou aperte espaço. Cada volta completa acelera o giro, e uma partida dura menos de um minuto.",
      "É grátis. Se quiser ajudar, jogue mais uma e conte para alguém qual foi seu recorde.",
    ],
  },
  {
    slug: "faroleiro-versao-1-0",
    game: "faroleiro",
    kind: "lancamento",
    title: "Faroleiro chega na versão 1.0",
    at: "2026-11-12T11:05:00-03:00",
    body: [
      "Foram três anos escrevendo sobre uma pessoa que cuida de uma luz que ninguém mais usa. Hoje o Faroleiro sai para Windows, macOS e Linux.",
      "São cerca de duas horas, três invernos e três finais. Nenhum deles é o certo. Cada um depende de quais cartas você responde e de quando decide apagar o farol.",
      "O preço é pague o que quiser, com mínimo de R$ 5. Escolhi um mínimo baixo de propósito: quero que quem tem pouco também possa ler até o fim.",
    ],
  },
  {
    slug: "chuva-de-pixels-no-navegador",
    game: "chuva-de-pixels",
    kind: "lancamento",
    title: "Chuva de Pixels: pintar no ritmo",
    at: "2026-11-12T07:15:00-03:00",
    body: [
      "Chuva de Pixels é um jogo de ritmo sem texto nenhum. Cada gota que cai na batida deixa uma cor no asfalto, e você tem até o sol aparecer para pintar a rua inteira.",
      "Roda no navegador e cabe numa pausa de café. Não há placar on-line nem conta para criar: só a música, a rua e o que sobrou de cor quando a chuva passa.",
    ],
  },
  {
    slug: "cidade-submersa-1-0-1",
    game: "cidade-submersa",
    kind: "atualizacao",
    title: "Versão 1.0.1: mais ar no terceiro mergulho",
    at: "2026-11-12T08:02:00-03:00",
    body: [
      "Muita gente ficou presa no terceiro mergulho, o da igreja. O caminho até a torre era longo demais para o ar que a gente dava. Aumentamos o tanque nessa parte e marcamos melhor a saída.",
      "Também corrigimos o diário, que às vezes não guardava a última página encontrada, e a legenda que sumia quando o volume estava no zero.",
      "Quem já está no meio do jogo não perde nada: o salvamento continua valendo.",
    ],
  },
  {
    slug: "pombo-correio-fisica-de-pombo",
    game: "pombo-correio-simulador",
    kind: "devlog",
    title: "Física de pombo: menos realista, mais engraçada",
    at: "2026-11-11T18:40:00-03:00",
    body: [
      "A primeira versão do pombo usava uma simulação de voo quase séria. Era bonita e não tinha graça nenhuma. O pombo voava bem demais.",
      "Na segunda tentativa, cada asa virou um impulso separado, com um atraso pequeno entre o comando e o bater. O pombo passou a errar janelas, bater em toldos e pousar de lado. Ficou muito melhor.",
      "A regra que sobrou: se uma mudança deixa o pombo mais competente, ela precisa deixar ele mais engraçado também. Se não deixa, sai.",
    ],
  },
  {
    slug: "carta-para-ninguem-respostas-novas",
    game: "carta-para-ninguem",
    kind: "atualizacao",
    title: "Doze respostas novas e um remetente a mais",
    at: "2026-11-11T10:00:00-03:00",
    body: [
      "Carta para Ninguém ganhou doze respostas novas. Algumas aparecem só se você escreve à noite, pelo relógio do seu aparelho.",
      "Há também um remetente novo, que só responde quem escreveu pelo menos três cartas sem pedir nada. Não vou contar quem é.",
      "Como o jogo é pague o que quiser sem mínimo, a atualização chega para todo mundo do mesmo jeito.",
    ],
  },
  {
    slug: "jardim-de-bolso-clima-local",
    game: "jardim-de-bolso",
    kind: "atualizacao",
    title: "O jardim agora sente o clima lá fora",
    at: "2026-11-11T07:30:00-03:00",
    body: [
      "Desde o lançamento, o Jardim de Bolso seguia o tempo real do telefone, mas o clima era sempre o mesmo. A partir de hoje, se você permitir, ele usa a previsão da sua cidade: chove no vaso quando chove na janela.",
      "A permissão de localização é opcional. Sem ela, o jardim segue um clima calmo e previsível, como antes.",
      "Também ajustamos a sétima estação, que florescia rápido demais em telefones com o relógio adiantado.",
    ],
  },
  {
    slug: "tecela-dez-fases-de-sarja",
    game: "tecela",
    kind: "atualizacao",
    title: "Dez fases novas de sarja",
    at: "2026-11-10T21:00:00-03:00",
    body: [
      "A Tecelã ganhou um capítulo inteiro sobre sarja, o ponto diagonal das calças jeans. São dez fases em que o fio passa por cima de dois e por baixo de um, e o desenho só aparece quando você para de pensar em linhas retas.",
      "O capítulo entra na versão atual do jogo, sem custo a mais, e o preço continua o mesmo.",
    ],
  },
  {
    slug: "golem-de-bolso-musgo-e-vidro",
    game: "golem-de-bolso",
    kind: "atualizacao",
    title: "Musgo mais fraco, vidro mais vivo",
    at: "2026-11-10T09:15:00-03:00",
    body: [
      "O golem de musgo regenerava rápido demais e virava a resposta para tudo. Agora ele cura só quando está parado, o que muda bastante o jeito de jogar com ele.",
      "O vidro ia para o outro extremo: quebrava no primeiro golpe e ninguém escolhia. Ele continua frágil, mas reflete parte do dano de volta, e dá para montar uma partida inteira em torno disso.",
      "As outras mudanças estão na lista completa dentro do jogo, no menu de notas.",
    ],
  },
  {
    slug: "barco-de-papel-como-a-agua-sobe",
    game: "barco-de-papel",
    kind: "devlog",
    title: "Como a água sobe no Barco de Papel",
    at: "2026-11-09T12:00:00-03:00",
    body: [
      "A pergunta que mais recebemos é se a água sobe sempre na mesma velocidade. Não sobe. Ela segue o ritmo da chuva, e a chuva segue você.",
      "Quando você para muito tempo num lugar seguro, a chuva engrossa. Quando você corre, ela afina. A ideia era que o barco nunca ficasse confortável, mas também nunca fosse punido por ir rápido.",
      "Fizemos umas quarenta versões dessa regra. A que ficou é a mais simples: a água olha para quanto tempo faz desde a última tampinha que você pulou.",
    ],
  },
  {
    slug: "quarto-404-um-jogo-mudo-em-48-horas",
    game: "quarto-404",
    kind: "jam",
    title: "Um jogo mudo em 48 horas",
    at: "2026-11-09T10:00:00-03:00",
    body: [
      "Fizemos o Quarto 404 para a Mini Jam Silêncio, que proibia qualquer som. Parecia uma restrição pequena. Não era.",
      "Sem som, cada pista precisa estar na tela. A porta que range vira uma porta que treme. O telefone que toca vira uma luz que pisca no ritmo de um toque. Passamos metade da jam descobrindo como dizer coisas que a gente sempre disse com áudio.",
      "O jogo fica no programa do jeito que foi entregue no fim da jam, com os erros e tudo. Uma versão corrigida, se vier, sai como outra entrada.",
    ],
  },
  {
    slug: "neblina-1987-por-que-240-linhas",
    game: "neblina-1987",
    kind: "devlog",
    title: "Por que a imagem tem 240 linhas",
    at: "2026-11-08T22:00:00-03:00",
    body: [
      "Neblina 1987 roda numa resolução vertical de 240 linhas, a mesma de uma fita VHS gravada em velocidade lenta. Não é nostalgia: é medo.",
      "Com pouca resolução, o que está no acostamento nunca fica nítido. Você vê uma forma, e sua cabeça completa o resto. Em testes com resolução alta, ninguém se assustava, porque dava para ver que era só um poste.",
      "Deixamos uma opção de imagem limpa no menu para quem sente desconforto com o ruído. O jogo fica menos assustador, e tudo bem.",
    ],
  },
  {
    slug: "ferro-velho-cada-lata-tem-seu-tempo",
    game: "ferro-velho-orquestra",
    kind: "devlog",
    title: "Cada lata tem um tempo próprio",
    at: "2026-11-07T19:00:00-03:00",
    body: [
      "No Ferro-Velho Orquestra nada toca no tempo certo, e isso é de propósito. Cada objeto tem um pequeno atraso, sempre o mesmo, que depende do material.",
      "Mola atrasa mais que lata. Calota atrasa menos que mola. Quando você junta três ou quatro coisas na esteira, esses atrasos formam um suingue que nenhum metrônomo faria.",
      "Se quiser um ritmo reto, existe um ímã que alinha tudo. Quase ninguém usa.",
    ],
  },
  {
    slug: "sopa-de-letras-teste-13-kb",
    game: "sopa-de-letras-infinita",
    kind: "jam",
    title: "Quanto da Sopa de Letras cabe em 13 KB",
    at: "2026-11-06T16:20:00-03:00",
    body: [
      "Antes de abrir a Jam 13 KB, quis saber se a regra era justa. Peguei a Sopa de Letras Infinita e tentei espremer o jogo no limite.",
      "A grade infinita coube. O dicionário não: mesmo comprimido, ele sozinho passava do tamanho. A solução foi gerar palavras a partir de sílabas, o que deixa a sopa mais estranha e, para mim, mais divertida.",
      "Essa versão pequena não substitui a entrada normal do catálogo. Ela é só a prova de que 13 KB dá para muita coisa. A jam abre no dia 22.",
    ],
  },
  {
    slug: "ultimos-onibus-a-linha-que-cortamos",
    game: "ultimos-onibus",
    kind: "devlog",
    title: "A sexta linha que cortamos",
    at: "2026-11-06T09:30:00-03:00",
    body: [
      "Últimos Ônibus tem cinco linhas noturnas. Durante quase um ano, teve seis.",
      "A sexta passava pelo aeroporto e tinha a passageira de que mais gostávamos. Mas todas as conversas dela acabavam explicando as outras cinco. Ela respondia as perguntas que o jogo devia deixar abertas.",
      "Cortar doeu. O jogo ficou mais curto e melhor. Talvez ela volte um dia, sozinha, em outra coisa.",
    ],
  },
  {
    slug: "mare-baixa-de-onde-vem-a-mare",
    game: "mare-baixa",
    kind: "devlog",
    title: "De onde vem a maré do Maré Baixa",
    at: "2026-11-05T06:30:00-03:00",
    body: [
      "O Maré Baixa usa uma tábua de marés para decidir quando você pode pescar. Ela vem embutida no jogo e cobre o ano inteiro, então o jogo funciona sem internet, na beira do mangue ou no ônibus.",
      "Quando a água sobe, a partida acaba. Não tem como estender. A ideia sempre foi essa: um jogo que manda você para casa.",
    ],
  },
];

const byNewest = (a: Devlog, b: Devlog) => +new Date(b.at) - +new Date(a.at);

export const devlogsByNewest = () => [...DEVLOGS].sort(byNewest);
export const devlogBySlug = (slug: string) => DEVLOGS.find((d) => d.slug === slug);

/** The game a note belongs to. Every note points at an existing catalogue game. */
export const devlogGame = (d: Devlog): Game => gameBySlug(d.game)!;

export const devlogCreator = (d: Devlog) => creatorBySlug(devlogGame(d).creator);

/** Other notes by the same creator, newest first. */
export function devlogsBySameCreator(d: Devlog): Devlog[] {
  const creator = devlogGame(d).creator;
  return DEVLOGS.filter((x) => x.slug !== d.slug && gameBySlug(x.game)?.creator === creator).sort(byNewest);
}

/** Previous (older) and next (newer) notes in date order. */
export function devlogNeighbours(d: Devlog): { older?: Devlog; newer?: Devlog } {
  const list = devlogsByNewest();
  const i = list.findIndex((x) => x.slug === d.slug);
  return { newer: i > 0 ? list[i - 1] : undefined, older: i < list.length - 1 ? list[i + 1] : undefined };
}
