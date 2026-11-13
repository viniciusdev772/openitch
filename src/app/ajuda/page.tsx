import "@/styles/leitura.css";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { PLATFORMS, TRACKS, formatPrice, shortPrice, type Platform, type Price } from "@/data/catalog";
import { TrackChip } from "@/components/bits";
import { GuideHead, GuideSection } from "@/components/leitura/Guide";
import { Contents } from "@/components/leitura/Contents";
import { Question } from "@/components/leitura/Question";

export const metadata: Metadata = {
  title: "Ajuda",
  description:
    "Respostas curtas sobre jogar, publicar, preços, plataformas, jams e a segurança da sua conta na VibeGames.",
};

const PRICE_EXAMPLES: { model: string; price: Price; what: string }[] = [
  { model: "Grátis", price: { kind: "free" }, what: "Ninguém paga nada." },
  { model: "Preço fixo", price: { kind: "fixed", amount: 24 }, what: "Todo mundo paga o mesmo valor." },
  {
    model: "Pague o que quiser, com mínimo",
    price: { kind: "pwyw", minimum: 5 },
    what: "Você escolhe o valor, a partir do mínimo de quem fez.",
  },
  {
    model: "Pague o que quiser, sem mínimo",
    price: { kind: "pwyw", minimum: 0 },
    what: "Você escolhe o valor, inclusive zero.",
  },
];

const PLATFORM_NOTES: Record<Platform, string> = {
  web: "Roda na própria página do jogo, sem instalar nada.",
  windows: "Arquivo para baixar e rodar no Windows.",
  macos: "Arquivo para baixar e rodar no Mac.",
  linux: "Arquivo para baixar e rodar no Linux.",
  android: "Arquivo para instalar no celular ou tablet Android.",
};

interface Chapter {
  id: string;
  title: string;
  intro: string;
  questions: { id: string; q: string; a: ReactNode }[];
}

const CHAPTERS: Chapter[] = [
  {
    id: "jogar",
    title: "Jogar",
    intro: "Encontrar, abrir e jogar.",
    questions: [
      {
        id: "jogar-conta",
        q: "Preciso de conta para jogar?",
        a: <p>Não. Você abre qualquer página de jogo e joga sem entrar. A conta serve para publicar e cuidar do que é seu.</p>,
      },
      {
        id: "jogar-navegador",
        q: "Como sei se um jogo roda no navegador?",
        a: (
          <p>
            A capa traz o selo “Joga aqui” e o código N fica aceso. No <Link href="/jogos?trilha=navegador">catálogo</Link>,
            a trilha Navegador junta só esses jogos.
          </p>
        ),
      },
      {
        id: "jogar-achar",
        q: "Como acho um jogo do tipo que eu gosto?",
        a: (
          <p>
            Pelas trilhas, pelos filtros de plataforma e de preço no <Link href="/jogos">catálogo</Link>, ou pelas tags na
            página de cada jogo, que abrem uma busca.
          </p>
        ),
      },
      {
        id: "jogar-baixar",
        q: "Posso baixar os jogos?",
        a: (
          <p>
            A página de cada jogo vai listar os arquivos por plataforma, com nome e tamanho, e o download sai direto do
            armazenamento. Como nenhum jogo foi publicado ainda, por enquanto só quem enviou baixa os próprios arquivos.
          </p>
        ),
      },
      {
        id: "jogar-numero",
        q: "O que é o Nº ao lado de cada jogo?",
        a: <p>É o número da entrada no programa. Serve para citar e reencontrar um jogo, como num catálogo impresso.</p>,
      },
    ],
  },
  {
    id: "publicar",
    title: "Publicar",
    intro: "Do arquivo à página no programa.",
    questions: [
      {
        id: "publicar-como",
        q: "Como publico um jogo?",
        a: (
          <p>
            Em <Link href="/publicar">Publicar</Link>, em cinco passos: o jogo, a trilha e a capa, as plataformas e os
            arquivos, o preço e a página. A sua entrada aparece ao lado e muda enquanto você escreve.
          </p>
        ),
      },
      {
        id: "publicar-botao",
        q: "O que fica salvo quando clico em “Salvar rascunho”?",
        a: (
          <p>
            Com a conta aberta, o texto, a trilha, a capa, as plataformas, o preço e a jam ficam guardados como rascunho,
            só para você, em <Link href="/conta/projetos">Seus rascunhos</Link>, junto com os arquivos que você enviou. Dá
            para reabrir e continuar depois. A publicação no programa ainda não existe: nenhum rascunho vira página
            pública.
          </p>
        ),
      },
      {
        id: "publicar-arquivos",
        q: "Que arquivos vou poder enviar?",
        a: (
          <p>
            Builds de até 3 GB para Windows, macOS, Linux e Android, em qualquer formato (zip, 7z, exe, dmg, AppImage, apk e
            outros), e uma versão para navegador (zip ou pasta) de Unity, Godot, Unreal 4 HTML5, Construct, GameMaker,
            Defold, PICO-8 ou HTML5. O envio vai direto do seu navegador para o armazenamento, em partes, e continua de
            onde parou se a conexão cair. Jogos feitos no Unreal 5 entram como download: a engine não exporta para
            navegador.
          </p>
        ),
      },
      {
        id: "publicar-conta",
        q: "Preciso de conta para publicar?",
        a: (
          <p>
            Para testar o formulário, não. Para salvar um rascunho, sim, e a publicação também vai pedir uma conta quando
            estiver ligada. <Link href="/criar-conta">Criar conta</Link> leva um minuto.
          </p>
        ),
      },
      {
        id: "publicar-trilha",
        q: "Qual trilha eu escolho?",
        a: (
          <>
            <p>A que descreve como o jogo é jogado. A trilha define a cor e a seção da sua entrada no programa.</p>
            <ul className="ref-list">
              {TRACKS.map((t) => (
                <li key={t.id}>
                  <TrackChip id={t.id} />
                  <span>{t.blurb}</span>
                </li>
              ))}
            </ul>
          </>
        ),
      },
    ],
  },
  {
    id: "precos",
    title: "Preços",
    intro: "Quem faz o jogo escolhe o preço. O programa só mostra.",
    questions: [
      {
        id: "precos-modelos",
        q: "Quais modelos de preço existem?",
        a: (
          <>
            <p>Três: grátis, preço fixo, e pague o que quiser, com ou sem um valor mínimo.</p>
            <table className="ref-table">
              <caption className="visually-hidden">Como cada modelo de preço aparece no programa</caption>
              <thead>
                <tr>
                  <th scope="col">Modelo</th>
                  <th scope="col">Nas listas</th>
                  <th scope="col">Na página do jogo</th>
                </tr>
              </thead>
              <tbody>
                {PRICE_EXAMPLES.map((ex) => (
                  <tr key={ex.model}>
                    <th scope="row">
                      {ex.model}
                      <small>{ex.what}</small>
                    </th>
                    <td>
                      <span className="price-tag">{shortPrice(ex.price)}</span>
                    </td>
                    <td className="ref-num">{formatPrice(ex.price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ),
      },
      {
        id: "precos-minimo",
        q: "Como funciona o mínimo do pague o que quiser?",
        a: (
          <p>
            Quem fez o jogo escolhe um valor mínimo, ou zero para deixar livre. Abaixo do mínimo, o botão de pagar fica
            travado e a página diz qual é o valor.
          </p>
        ),
      },
      {
        id: "precos-taxa",
        q: "Quanto a VibeGames fica de cada venda?",
        a: (
          <p>
            Ainda não está decidido. Não existe taxa da plataforma nem divisão de receita definida, e nenhum provedor de
            pagamento foi escolhido.
          </p>
        ),
      },
      {
        id: "precos-pagar",
        q: "Consigo pagar por um jogo hoje?",
        a: (
          <p>
            Não. Os pagamentos não estão ligados. O cartão de compra mostra o valor e o botão, mas nada é cobrado.
          </p>
        ),
      },
    ],
  },
  {
    id: "plataformas",
    title: "Plataformas",
    intro: "A legenda de cinco letras que aparece em todo o programa.",
    questions: [
      {
        id: "plataformas-letras",
        q: "O que querem dizer as letras N W M L A?",
        a: (
          <>
            <p>Cada letra é uma plataforma. A fila de cinco aparece inteira em cada jogo.</p>
            <dl className="legend-list">
              {(Object.keys(PLATFORMS) as Platform[]).map((p) => (
                <div key={p}>
                  <dt>
                    <span className="code" aria-hidden>
                      {PLATFORMS[p].code}
                    </span>
                    {PLATFORMS[p].name}
                  </dt>
                  <dd>{PLATFORM_NOTES[p]}</dd>
                </div>
              ))}
            </dl>
          </>
        ),
      },
      {
        id: "plataformas-apagadas",
        q: "Por que algumas letras aparecem apagadas?",
        a: (
          <p>
            As plataformas que o jogo não tem ficam apagadas, no lugar delas. Assim dá para comparar dois jogos de relance,
            letra por letra.
          </p>
        ),
      },
      {
        id: "plataformas-celular",
        q: "Jogos de navegador funcionam no celular?",
        a: <p>Depende de como cada jogo foi feito. A página do jogo diz o que ele pede: teclado, mouse ou toque.</p>,
      },
    ],
  },
  {
    id: "jams",
    title: "Jams",
    intro: "Maratonas com tema e relógio.",
    questions: [
      {
        id: "jams-o-que",
        q: "O que é uma jam?",
        a: (
          <p>
            Uma maratona para fazer um jogo com um tema, num prazo. Na maioria das jams, as entradas entram no programa
            juntas quando o prazo acaba; algumas publicam cada jogo assim que ele é enviado, e a página da jam diz qual é o
            caso.
          </p>
        ),
      },
      {
        id: "jams-agenda",
        q: "Como leio a agenda de jams?",
        a: (
          <p>
            Em <Link href="/jams">Jams</Link>, cada jam é uma barra na linha do tempo, da abertura ao fim. Uma linha marca o
            momento atual. Barras apagadas são jams que já acabaram.
          </p>
        ),
      },
      {
        id: "jams-participar",
        q: "Como participo de uma jam?",
        a: <p>Ainda não dá: a inscrição em jams não está ligada, e nenhuma jam está marcada.</p>,
      },
      {
        id: "jams-organizar",
        q: "Posso organizar uma jam?",
        a: <p>Ainda não pelo site. Criar uma jam com tema, datas e lista de entradas é uma das partes que faltam.</p>,
      },
    ],
  },
  {
    id: "conta",
    title: "Conta e segurança",
    intro: "Estas respostas descrevem o que o sistema de contas faz de verdade, com os números que ele usa.",
    questions: [
      {
        id: "conta-senha",
        q: "Que senha posso usar?",
        a: (
          <>
            <p>
              De 10 a 128 caracteres. Uma frase curta funciona bem. Recusamos as senhas mais usadas do mundo e senhas que
              contêm o seu nome ou a parte do seu e-mail antes do @.
            </p>
            <p>
              Também conferimos se a senha já apareceu em vazamentos de outros sites. A consulta é anônima: só os 5 primeiros
              caracteres de um resumo da senha saem do servidor, nunca a senha.
            </p>
          </>
        ),
      },
      {
        id: "conta-guardada",
        q: "Como a minha senha fica guardada?",
        a: (
          <p>
            Nunca como texto. Guardamos só um resumo feito com um algoritmo lento de propósito (scrypt) e uma chave que fica
            fora do banco de dados, o que torna inútil copiar o banco para tentar adivinhar senhas.
          </p>
        ),
      },
      {
        id: "conta-erros",
        q: "O que acontece se eu errar a senha?",
        a: (
          <>
            <p>
              A mensagem é sempre “E-mail ou senha incorretos”, sem dizer qual dos dois. Depois de 5 erros para o mesmo
              e-mail, a partir da mesma rede, as entradas nesse e-mail pausam por 15 minutos.
            </p>
            <p>
              Há também um teto de 50 erros por e-mail em uma hora, somando todas as redes, e de 30 tentativas por rede a
              cada 15 minutos. Se travar, espere o tempo que a página indicar ou{" "}
              <Link href="/recuperar">recupere o acesso</Link>.
            </p>
          </>
        ),
      },
      {
        id: "conta-sessao",
        q: "Quanto tempo dura uma sessão?",
        a: (
          <table className="ref-table">
            <caption className="visually-hidden">Duração das sessões</caption>
            <thead>
              <tr>
                <th scope="col">Ao entrar</th>
                <th scope="col">Dura até</th>
                <th scope="col">Acaba antes se ficar parada</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Com “manter conectado”</th>
                <td className="ref-num">30 dias</td>
                <td className="ref-num">7 dias</td>
              </tr>
              <tr>
                <th scope="row">
                  Sem “manter conectado”
                  <small>E também quando você fecha o navegador.</small>
                </th>
                <td className="ref-num">12 horas</td>
                <td className="ref-num">2 horas</td>
              </tr>
            </tbody>
          </table>
        ),
      },
      {
        id: "conta-sessoes",
        q: "Como vejo onde a minha conta está aberta?",
        a: (
          <>
            <p>
              Em <Link href="/conta">Sua conta</Link>, a lista de sessões mostra cada aparelho, a última atividade e o local
              aproximado. Você encerra uma sessão ou todas as outras de uma vez.
            </p>
            <p>
              O registro de segurança guarda entradas, erros de senha e mudanças na conta por 180 dias. Só você vê.
            </p>
          </>
        ),
      },
      {
        id: "conta-duas-etapas",
        q: "O que é a verificação em duas etapas?",
        a: (
          <>
            <p>
              Depois da senha, pedimos um código de 6 dígitos de um app autenticador no seu celular. O código muda a cada 30
              segundos, então quem descobrir sua senha ainda não entra.
            </p>
            <p>
              Você liga em <Link href="/conta/duas-etapas">três passos</Link>: instalar o app, escanear o código QR e
              confirmar com um código. Ao ligar, as outras sessões abertas são encerradas.
            </p>
          </>
        ),
      },
      {
        id: "conta-relogio",
        q: "E se o relógio do celular estiver um pouco errado?",
        a: (
          <p>
            Aceitamos também o código anterior e o seguinte, uma folga de 30 segundos para cada lado. Cada código serve uma
            vez só: depois de usado, não entra de novo.
          </p>
        ),
      },
      {
        id: "conta-tempo-codigo",
        q: "Quanto tempo tenho para digitar o código?",
        a: (
          <p>
            Depois da senha certa, 5 minutos e até 5 tentativas. Passando disso, você volta para a senha e começa de novo.
          </p>
        ),
      },
      {
        id: "conta-recuperacao",
        q: "O que são os códigos de recuperação?",
        a: (
          <p>
            Ao criar a conta você recebe 10 códigos, cada um com 10 letras e números, como k7m2q-x9c4d. Cada código serve uma
            vez, no lugar do código do app ou para criar uma senha nova. Guarde fora do computador.
          </p>
        ),
      },
      {
        id: "conta-esqueci",
        q: "Esqueci a senha. E agora?",
        a: (
          <>
            <p>
              Em <Link href="/recuperar">Recuperar acesso</Link>, escreva seu e-mail, um código de recuperação e a senha
              nova. Ao salvar, todas as sessões abertas são encerradas, em qualquer aparelho.
            </p>
            <p>
              Não enviamos e-mail. Sem um código de recuperação, hoje não há como provar que a conta é sua.
            </p>
          </>
        ),
      },
      {
        id: "conta-novos-codigos",
        q: "Posso gerar códigos de recuperação novos?",
        a: (
          <p>
            Sim, em <Link href="/conta">Sua conta</Link>, com a sua senha e, se as duas etapas estiverem ligadas, um código do
            app. Os novos substituem todos os antigos. Um código de recuperação não serve para gerar outros.
          </p>
        ),
      },
      {
        id: "conta-desligar-excluir",
        q: "Como desligo as duas etapas ou excluo a conta?",
        a: (
          <p>
            As duas coisas ficam em <Link href="/conta">Sua conta</Link>. Desligar as duas etapas pede a senha e um código.
            Excluir pede a senha, a palavra “excluir” e, se as duas etapas estiverem ligadas, um código. A exclusão apaga a
            conta, as sessões e o registro de segurança.
          </p>
        ),
      },
    ],
  },
];

export default function AjudaPage() {
  const total = CHAPTERS.reduce((n, c) => n + c.questions.length, 0);
  return (
    <>
      <GuideHead title="Ajuda" current="ajuda">
        <p>
          Respostas curtas, por assunto. São <span className="num">{total}</span> perguntas sobre jogar, publicar, preços,
          plataformas, jams e a segurança da sua conta.
        </p>
      </GuideHead>

      <div className="wrap guide">
        <aside className="guide-side">
          <Contents
            title="Assuntos"
            countLabel="perguntas"
            items={CHAPTERS.map((c) => ({ id: c.id, label: c.title, count: c.questions.length }))}
          />
        </aside>

        <div className="guide-col">
          {CHAPTERS.map((c) => (
            <GuideSection key={c.id} id={c.id} title={c.title} intro={c.intro}>
              <div className="qa-list">
                {c.questions.map((item) => (
                  <Question key={item.id} id={item.id} q={item.q}>
                    {item.a}
                  </Question>
                ))}
              </div>
            </GuideSection>
          ))}

          <nav className="guide-next" aria-label="Para onde seguir">
            <h2>Não achou a resposta?</h2>
            <p className="guide-intro">
              <Link href="/sobre">Como funciona a VibeGames</Link> explica o que já existe e o que ainda falta, parte por parte.
            </p>
          </nav>
        </div>
      </div>
    </>
  );
}
