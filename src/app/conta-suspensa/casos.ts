/*
 * Os casos do jogo "O Recurso" e como os juízes pesam cada resposta. Sem
 * nada de 3D aqui: é a parte que decide, e tem teste (__tests__/casos.test.ts).
 *
 * O que o jogo ensina é o que vale no recurso de verdade
 * (lib/moderation/tribunal.ts): fato específico e prova que dá para conferir
 * pesam; tom emocional, ataque e resposta vaga derrubam.
 */

export type Tone = "especifico" | "fato" | "emocao" | "ataque" | "evasivo";
export type EvidenceKind = "print" | "email" | "documento" | "notebook" | "celular" | "nota";

export interface Evidence {
  id: string;
  kind: EvidenceKind;
  title: string;
  /** O que a prova mostra, como aparece ao examinar. */
  text: string;
  /** Força da prova, de -1 (atrapalha) a 1 (decide). */
  weight: number;
  /** Dá para conferir (um código, um contrato com número, um histórico público)? */
  verifiable: boolean;
  /** Mostra envolvimento, mas não é permissão (créditos, por exemplo). */
  creditOnly?: boolean;
}

export interface Answer {
  text: string;
  tone: Tone;
}

export interface Question {
  judge: number;
  text: string;
  /** Provas que respondem a esta pergunta. */
  wants: string[];
  answers: Answer[];
}

export interface Case {
  id: string;
  game: string;
  rule: string;
  accusation: string;
  yourSide: string;
  evidence: Evidence[];
  questions: Question[];
}

export interface JudgeProfile {
  name: string;
  title: string;
  /** Uma linha sobre o que este juiz valoriza (aparece na ficha). */
  trait: string;
  start: number;
}

export const JUDGES: JudgeProfile[] = [
  { name: "Dra. Aurora Lins", title: "Relatora", trait: "Lê cada documento. Prova forte pesa o dobro para ela.", start: -0.3 },
  { name: "Dr. Bento Sales", title: "Ministro", trait: "Não suporta drama. Emoção e ataque contam em dobro contra.", start: -0.3 },
  { name: "Dra. Clara Moura", title: "Ministra", trait: "Quer detalhes: datas, números, nomes de arquivo.", start: -0.3 },
  { name: "Dr. Dario Faria", title: "Ministro", trait: "Sabe as regras de cor. Crédito não é permissão.", start: -0.3 },
  { name: "Dra. Elisa Prado", title: "Presidente", trait: "Cética. Só conta prova que dá para conferir.", start: -0.45 },
];

/** Quantas provas cabem na pasta da tribuna. */
export const MAX_CARRY = 3;
/** Votos para reverter a decisão (4 de 5, como no plenário de verdade). */
export const NEEDED = 4;

/*
 * Calibragem: responder só com detalhes, sem prova, deixa a maioria dos
 * juízes no zero (perde); uma prova forte e conferível, com respostas
 * específicas, vira o plenário (ganha). Quem não fez a pergunta sente metade
 * do peso da prova; quem fez, uma vez e meia tudo.
 */
const TONE: Record<Tone, number> = { especifico: 0.1, fato: 0.04, emocao: -0.26, ataque: -0.45, evasivo: -0.18 };

/** Quanto uma resposta (e a prova anexada, se houver) move o voto de cada juiz. */
export function score(q: Question, answer: Answer, ev: Evidence | null): number[] {
  return JUDGES.map((_, i) => {
    let tone = TONE[answer.tone];
    if (i === 1 && (answer.tone === "emocao" || answer.tone === "ataque")) tone *= 2;
    if (i === 2 && answer.tone === "especifico") tone *= 1.6;
    if (i === 2 && answer.tone === "evasivo") tone *= 2;
    let proof = 0;
    if (ev) {
      proof = q.wants.includes(ev.id) ? ev.weight : ev.weight > 0 ? ev.weight * 0.3 : ev.weight;
      if (i === 0 && proof > 0) proof *= 1.5;
      if (i === 3 && ev.creditOnly) proof = -0.15;
      if (i === 3 && q.wants.includes(ev.id) && ev.weight > 0) proof += 0.1;
      if (i === 4 && !ev.verifiable && proof > 0) proof = 0;
    }
    const asked = i === q.judge;
    const v = tone + proof * (asked ? 1 : 0.5);
    return asked ? v * 1.5 : v;
  });
}

/** Margem para um juiz votar por reverter: empatado no zero não conta (nem o zero do ponto flutuante). */
export const CONVINCED = 0.05;
/** O voto de cada juiz: reverter (true) se passou da margem. */
export const votes = (lean: number[]) => lean.map((v) => v > CONVINCED);
export const accepted = (lean: number[]) => votes(lean).filter(Boolean).length >= NEEDED;

/** A frase curta do juiz que perguntou, logo depois da resposta. */
export function reaction(delta: number, answer: Answer, ev: Evidence | null): string {
  if (ev && ev.weight < 0) return "Esta prova não ajuda você. Pelo contrário.";
  if (delta > 0.6) return "Isso é concreto e dá para conferir. Anotado.";
  if (delta > 0.2) return "Certo. Anotado.";
  if (answer.tone === "especifico" && !ev) return "Bem detalhado. Mas o que comprova isso?";
  if (answer.tone === "emocao") return "Entendo que seja difícil, mas emoção não é prova.";
  if (answer.tone === "ataque") return "Esse tom não ajuda o seu caso.";
  if (answer.tone === "evasivo") return "Você não respondeu à pergunta.";
  return "Isso ainda não me convence.";
}

/** Uma linha por juiz para o veredito: por que votou assim. */
export function verdictLine(i: number, lean: number, log: { tone: Tone; ev: Evidence | null }[]): string {
  const yes = lean > CONVINCED;
  const hurt = log.some((l) => l.tone === "emocao" || l.tone === "ataque");
  const proofs = log.filter((l) => l.ev && l.ev.weight > 0);
  const harm = log.some((l) => l.ev && l.ev.weight < 0);
  if (harm && !yes) return "Uma das provas que você trouxe pesou contra você.";
  if (i === 1 && hurt) return yes ? "Relevou o tom, porque os fatos eram fortes." : "O tom das respostas pesou mais que os fatos.";
  if (i === 4) return yes ? "As provas podiam ser conferidas." : "Faltou uma prova que desse para conferir.";
  if (i === 0) return yes ? `As ${proofs.length} prova(s) responderam às perguntas.` : "Os documentos não responderam ao que foi perguntado.";
  if (i === 2) return yes ? "As respostas tinham detalhes que dá para checar." : "Faltaram detalhes: datas, números, nomes.";
  if (i === 3) return yes ? "O recurso mostrou permissão, não só crédito." : "Crédito e boa intenção não são permissão.";
  return yes ? "Convencido." : "Não convencido.";
}

export const CASES: Case[] = [
  {
    id: "copia-itch",
    game: "Farol de Tinta",
    rule: "Só publique o que é seu",
    accusation:
      "O jogo “Farol de Tinta” foi trazido da página maraquint.itch.io/farol-de-tinta. A conta que publicou no Portal não é a da autora da página, Mara Quint.",
    yourSide:
      "Você é Tiago Reis, programador do jogo. A Mara fez a arte e é dona da página no itch.io. Vocês combinaram que você publicaria aqui.",
    evidence: [
      {
        id: "codigo",
        kind: "print",
        title: "Print da página do itch.io",
        text: "A descrição do jogo no itch.io mostra o código portaldosgames-3f9a1c, que é o código da sua conta. Só quem controla a página consegue colocá-lo lá.",
        weight: 0.8,
        verifiable: true,
      },
      {
        id: "email",
        kind: "email",
        title: "E-mail da Mara",
        text: "“Pode subir no Portal, combinado. Bjs, M.” Enviado de um endereço pessoal, sem assinatura.",
        weight: 0.35,
        verifiable: false,
      },
      {
        id: "creditos",
        kind: "documento",
        title: "Tela de créditos",
        text: "Arte: Mara Quint. Programação: Tiago Reis. Música: banco de sons CC0.",
        weight: 0.2,
        verifiable: true,
        creditOnly: true,
      },
      {
        id: "commits",
        kind: "notebook",
        title: "Histórico do repositório",
        text: "312 commits no GitHub, todos assinados por Tiago Reis, do primeiro dia do projeto até a versão publicada.",
        weight: 0.5,
        verifiable: true,
      },
      {
        id: "fas",
        kind: "nota",
        title: "Comentários de jogadores",
        text: "Doze comentários elogiando a arte e a trilha. Nenhum fala de quem publicou.",
        weight: 0,
        verifiable: true,
      },
      {
        id: "discord",
        kind: "celular",
        title: "Mensagem no Discord",
        text: "Você escreveu num servidor: “esse tribunal de robôs é piada, se não voltar eu publico com outra conta”.",
        weight: -0.7,
        verifiable: true,
      },
    ],
    questions: [
      {
        judge: 4,
        text: "A página original pertence a outra conta. O que prova que a autora autorizou esta publicação?",
        wants: ["codigo", "email"],
        answers: [
          { tone: "especifico", text: "A Mara colou o código da minha conta na descrição do jogo no itch.io. Só ela edita aquela página." },
          { tone: "fato", text: "Fizemos o jogo juntos e combinamos que eu publicaria aqui." },
          { tone: "emocao", text: "Isso é um absurdo. Eu trabalhei meses nesse jogo!" },
          { tone: "evasivo", text: "Todo mundo republica jogo do itch, não vejo o problema." },
        ],
      },
      {
        judge: 3,
        text: "Os créditos citam a autora, e crédito não é permissão. Qual é o seu papel no jogo?",
        wants: ["commits", "creditos"],
        answers: [
          { tone: "especifico", text: "Programei o jogo inteiro. Os 312 commits do repositório estão no meu nome, desde o primeiro dia." },
          { tone: "fato", text: "Sou um dos criadores. Meu nome está nos créditos." },
          { tone: "ataque", text: "Vocês nem leram os créditos direito." },
          { tone: "emocao", text: "Sem mim esse jogo nem existiria. Isso é muito injusto." },
        ],
      },
      {
        judge: 1,
        text: "Se a autora pedisse a remoção amanhã, o que você faria?",
        wants: ["email"],
        answers: [
          { tone: "especifico", text: "Tirava do ar no mesmo dia, pelo painel do projeto. Combinamos isso por escrito." },
          { tone: "fato", text: "Respeitaria a decisão dela." },
          { tone: "ataque", text: "Ela não vai pedir. E se pedir, é problema nosso, não do tribunal." },
          { tone: "evasivo", text: "Não acho que isso vá acontecer." },
        ],
      },
    ],
  },
  {
    id: "musica",
    game: "Corrida no Asfalto",
    rule: "Só publique o que é seu",
    accusation: "A trilha do jogo “Corrida no Asfalto” usa a música “Noite Neon”, da banda Os Voltagem, sem licença.",
    yourSide: "Você fez o jogo sozinho e comprou uma licença de uso da música num site de licenciamento.",
    evidence: [
      {
        id: "licenca",
        kind: "documento",
        title: "Contrato de licença",
        text: "Contrato LIC-48213, da SomLivre Licenças, em seu nome: uso da faixa “Noite Neon” em jogo independente, gratuito ou pago, até dezembro de 2028.",
        weight: 0.8,
        verifiable: true,
      },
      {
        id: "nota",
        kind: "nota",
        title: "Nota fiscal",
        text: "Nota fiscal de R$ 180,00 emitida pela SomLivre Licenças, na mesma data do contrato.",
        weight: 0.45,
        verifiable: true,
      },
      {
        id: "arquivo",
        kind: "notebook",
        title: "Pasta do projeto",
        text: "O arquivo noite_neon_licenciada.ogg carrega nos metadados o número LIC-48213.",
        weight: 0.3,
        verifiable: true,
      },
      {
        id: "curtida",
        kind: "celular",
        title: "Curtida da banda",
        text: "A conta oficial da banda curtiu um vídeo do seu jogo. Curtida não é licença.",
        weight: 0.1,
        verifiable: true,
        creditOnly: true,
      },
      {
        id: "video",
        kind: "print",
        title: "Vídeo de um jogador",
        text: "Um jogador gravou 20 minutos de partida e elogiou a música.",
        weight: 0,
        verifiable: true,
      },
      {
        id: "rascunho",
        kind: "email",
        title: "Rascunho escrito de madrugada",
        text: "Texto que você quase enviou: “robôs burros, vou processar todo mundo”.",
        weight: -0.6,
        verifiable: true,
      },
    ],
    questions: [
      {
        judge: 0,
        text: "Que documento mostra que você pode usar “Noite Neon” no jogo?",
        wants: ["licenca", "nota"],
        answers: [
          { tone: "especifico", text: "O contrato LIC-48213 da SomLivre Licenças, em meu nome, para uso da faixa em jogo." },
          { tone: "fato", text: "Eu comprei a licença da música." },
          { tone: "emocao", text: "Eu paguei com o meu dinheiro, isso não é justo!" },
          { tone: "evasivo", text: "Música em jogo indie todo mundo usa." },
        ],
      },
      {
        judge: 2,
        text: "A licença vale para jogo pago? Até quando?",
        wants: ["licenca"],
        answers: [
          { tone: "especifico", text: "Vale para jogo gratuito ou pago até dezembro de 2028, na cláusula 2 do contrato." },
          { tone: "fato", text: "Vale, sim." },
          { tone: "evasivo", text: "Acho que vale, não lembro direito." },
          { tone: "ataque", text: "Isso não é da conta do tribunal." },
        ],
      },
      {
        judge: 1,
        text: "Por que a licença não aparecia na página do jogo?",
        wants: ["arquivo"],
        answers: [
          { tone: "especifico", text: "Esqueci. Já incluí o número da licença e o crédito da banda na página e nos créditos." },
          { tone: "fato", text: "Não sabia que precisava." },
          { tone: "emocao", text: "Porque ninguém avisa nada neste site!" },
          { tone: "ataque", text: "Não tenho obrigação de explicar nada." },
        ],
      },
    ],
  },
  {
    id: "spam",
    game: "Batida Final",
    rule: "Nada de golpe, spam ou se passar por outra pessoa",
    accusation: "A conta deixou o link do jogo “Batida Final” em 9 comentários de outros jogos, em dois dias, sempre com a mesma frase.",
    yourSide:
      "Em várias páginas, pessoas perguntavam por jogos de ritmo parecidos e você indicou o seu. Mas colou a mesma frase, e três vezes ninguém tinha perguntado nada.",
    evidence: [
      {
        id: "perguntas",
        kind: "print",
        title: "Prints das perguntas",
        text: "Em 6 dos 9 comentários, você respondia a alguém que tinha perguntado “tem jogo parecido?”.",
        weight: 0.55,
        verifiable: true,
      },
      {
        id: "lista",
        kind: "documento",
        title: "Lista dos 9 comentários",
        text: "Data, jogo e texto de cada um. Três foram em páginas sem pergunta nenhuma.",
        weight: 0.25,
        verifiable: true,
      },
      {
        id: "desculpas",
        kind: "celular",
        title: "Pedido de desculpas publicado",
        text: "Você apagou os três comentários sem pergunta e publicou um pedido de desculpas no seu perfil, no dia 14.",
        weight: 0.5,
        verifiable: true,
      },
      {
        id: "agradece",
        kind: "email",
        title: "Mensagem de um jogador",
        text: "“Valeu pela dica, adorei o jogo!” Sem como saber quem mandou.",
        weight: 0.1,
        verifiable: false,
      },
      {
        id: "canal",
        kind: "notebook",
        title: "Seu canal de vídeos",
        text: "A descrição do canal anuncia: “divulgo seu jogo em 50 páginas por R$ 20”.",
        weight: -0.5,
        verifiable: true,
      },
      {
        id: "downloads",
        kind: "nota",
        title: "Contador de downloads",
        text: "O jogo passou de 40 para 310 downloads na semana dos comentários.",
        weight: 0,
        verifiable: true,
      },
    ],
    questions: [
      {
        judge: 2,
        text: "Quantos desses comentários respondiam a uma pergunta, e quantos não?",
        wants: ["perguntas", "lista"],
        answers: [
          { tone: "especifico", text: "Seis respondiam a perguntas, três não. Trouxe a lista dos nove, com data e página." },
          { tone: "fato", text: "A maioria respondia a alguém." },
          { tone: "evasivo", text: "Não contei." },
          { tone: "emocao", text: "Eu só queria que alguém jogasse o meu jogo…" },
        ],
      },
      {
        judge: 4,
        text: "O que você já fez sobre os comentários em que ninguém tinha perguntado nada?",
        wants: ["desculpas"],
        answers: [
          { tone: "especifico", text: "Apaguei os três e publiquei um pedido de desculpas no meu perfil, no dia 14." },
          { tone: "fato", text: "Parei de comentar." },
          { tone: "ataque", text: "Outros fazem muito pior e ninguém é suspenso." },
          { tone: "evasivo", text: "Nada ainda, mas posso ver isso." },
        ],
      },
      {
        judge: 1,
        text: "Por que colar a mesma frase nove vezes?",
        wants: ["lista"],
        answers: [
          { tone: "especifico", text: "Foi preguiça. Agora respondo cada pessoa com texto próprio, e só quando perguntam." },
          { tone: "fato", text: "Era a forma mais rápida." },
          { tone: "emocao", text: "Você sabe como é difícil divulgar um jogo sozinho?" },
          { tone: "ataque", text: "Se a regra fosse clara, eu não teria feito." },
        ],
      },
    ],
  },
];
