import "@/styles/leitura.css";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { GuideHead, GuideSection } from "@/components/leitura/Guide";
import { Contents } from "@/components/leitura/Contents";

export const metadata: Metadata = {
  title: "Como funciona a VibeGames",
  description:
    "O que é a VibeGames, para quem joga, para quem faz jogos e para quem organiza jams, os princípios do programa e o que já funciona hoje.",
};

const SECTIONS = [
  { id: "o-que-e", label: "O que é" },
  { id: "para-quem-joga", label: "Para quem joga" },
  { id: "para-quem-faz", label: "Para quem faz jogos" },
  { id: "para-quem-organiza", label: "Para quem organiza jams" },
  { id: "principios", label: "Princípios" },
  { id: "estado", label: "O que já existe" },
];

type State = "sim" | "parte" | "nao" | "aberto";

const STATE_LABEL: Record<State, string> = {
  sim: "Já funciona",
  parte: "Em parte",
  nao: "Ainda não",
  aberto: "Não decidido",
};

const STATUS: { part: string; state: State; note: React.ReactNode }[] = [
  {
    part: "Contas",
    state: "sim",
    note: (
      <>
        Criar conta, entrar, sair, trocar a senha e excluir a conta. A senha nunca fica guardada como texto. Veja{" "}
        <Link href="/ajuda#conta">Conta e segurança</Link>.
      </>
    ),
  },
  {
    part: "Verificação em duas etapas",
    state: "sim",
    note: "Com qualquer app autenticador, mais dez códigos de recuperação de uso único.",
  },
  {
    part: "Sessões e registro de segurança",
    state: "sim",
    note: (
      <>
        Em <Link href="/conta">Sua conta</Link> você vê onde está conectado e encerra o que não reconhece.
      </>
    ),
  },
  {
    part: "Estante",
    state: "sim",
    note: (
      <>
        Guardar jogos e seguir criadores, em <Link href="/estante">Sua estante</Link>. Só você vê.
      </>
    ),
  },
  {
    part: "Rascunhos de jogos",
    state: "sim",
    note: (
      <>
        A página do jogo fica salva como rascunho na sua conta, em{" "}
        <Link href="/conta/projetos">Seus rascunhos</Link>.
      </>
    ),
  },
  {
    part: "Catálogo, trilhas e filtros",
    state: "parte",
    note: "A navegação, a busca e os filtros estão prontos. O catálogo ainda está vazio: nenhum jogo foi publicado.",
  },
  {
    part: "Publicar no programa",
    state: "nao",
    note: "Um rascunho ainda não vira página pública.",
  },
  {
    part: "Jogar no navegador",
    state: "nao",
    note: "Depende do envio de arquivos, que ainda não existe.",
  },
  {
    part: "Envio de arquivos",
    state: "nao",
    note: "O formulário de publicação monta a prévia da entrada, mas não envia arquivo nenhum.",
  },
  {
    part: "Pagamentos",
    state: "nao",
    note: "Nenhum valor é cobrado nem repassado. Os botões de compra mostram o preço e param aí.",
  },
  {
    part: "E-mail",
    state: "nao",
    note: "Não enviamos e-mail. Quem esquece a senha volta com um código de recuperação.",
  },
  {
    part: "Taxa da plataforma",
    state: "aberto",
    note: "Ainda não existe taxa nem divisão de receita definida.",
  },
  {
    part: "Provedor de pagamento",
    state: "aberto",
    note: "Ainda não foi escolhido.",
  },
  {
    part: "Regras de moderação",
    state: "aberto",
    note: "Ainda não foram escritas.",
  },
];

export default function SobrePage() {
  return (
    <>
      <GuideHead title="Como funciona a VibeGames" current="sobre">
        <p>
          Um lugar aberto para publicar e jogar jogos independentes. Esta página conta o que ele faz hoje, para quem ele
          é e o que ainda falta.
        </p>
      </GuideHead>

      <div className="wrap guide">
        <aside className="guide-side">
          <Contents title="Nesta página" items={SECTIONS} />
        </aside>

        <div className="guide-col">
          <GuideSection id="o-que-e" title="O que é">
            <div className="guide-prose">
              <p>
                A VibeGames é uma vitrine e uma casa de publicação para jogos independentes. Quem faz um jogo cria uma
                página, escolhe o preço (ou nenhum) e o jogo entra no programa. Quem joga encontra, abre e joga, muitas
                vezes direto no navegador.
              </p>
              <p>
                O site é montado como o programa impresso de um festival que não fecha. Os jogos são entradas
                numeradas, as trilhas têm cor própria e as jams aparecem numa agenda, com hora para começar e acabar.
              </p>
              <p>
                O programa está começando: as contas, a estante e os rascunhos já funcionam, e o catálogo ainda está
                vazio. Os primeiros jogos entram quando a publicação for ligada.
              </p>
            </div>
          </GuideSection>

          <GuideSection id="para-quem-joga" title="Para quem joga">
            <div className="guide-prose">
              <p>
                Você não precisa de conta para olhar nem para jogar. O <Link href="/jogos">catálogo</Link> se divide em
                cinco trilhas (Navegador, Ação, Narrativo, Quebra-cabeça e Experimental) e tem filtros de plataforma e
                de preço, todos à vista, sem nada escondido em menus.
              </p>
              <p>
                Um jogo pode ser grátis, ter preço fixo ou deixar você pagar o que quiser, às vezes com um valor
                mínimo que quem fez escolheu. O preço aparece sempre do mesmo jeito, antes de qualquer clique.
              </p>
              <p>
                Por enquanto não há download nem cobrança: o envio de arquivos e os pagamentos ainda não estão
                ligados.
              </p>
            </div>
          </GuideSection>

          <GuideSection id="para-quem-faz" title="Para quem faz jogos">
            <div className="guide-prose">
              <p>
                Publicar é um formulário de cinco passos: o jogo, a trilha e a capa, os arquivos, o preço e a página.
                Enquanto você escreve, a sua entrada no programa aparece ao lado, do jeito que vai ser vista.
              </p>
              <p>
                Preço, página e arquivos são seus. Você decide se o jogo é grátis, quanto custa ou qual é o mínimo, e o
                formulário diz com clareza o que vai acontecer em cada passo.
              </p>
              <p>
                Hoje o formulário não envia arquivos nem cria a página de verdade: ele mostra o resultado e para. Para
                testar, abra <Link href="/publicar">Publicar</Link>. Para guardar seu lugar,{" "}
                <Link href="/criar-conta">crie uma conta</Link>.
              </p>
            </div>
          </GuideSection>

          <GuideSection id="para-quem-organiza" title="Para quem organiza jams">
            <div className="guide-prose">
              <p>
                Uma jam é uma maratona com tema e prazo. Na VibeGames ela tem um título, um tema, uma janela de datas e
                uma lista de entradas. Na <Link href="/jams">agenda de jams</Link>, cada uma é uma barra na linha do
                tempo, e uma linha marca o que está acontecendo agora.
              </p>
              <p>
                Quando o prazo acaba, as entradas entram no programa juntas, e cada jogo leva na página o nome da jam
                de onde veio.
              </p>
              <p>
                Ainda não dá para criar uma jam pelo site, nem inscrever um jogo, e nenhuma jam está marcada.
              </p>
            </div>
          </GuideSection>

          <GuideSection id="principios" title="Princípios" intro="Quatro regras que decidem como cada página é feita.">
            <dl className="principles">
              <div>
                <dt>O jogo vem primeiro</dt>
                <dd>Cada página existe para você ver, entender e jogar um jogo mais rápido. O resto vem depois.</dd>
              </div>
              <div>
                <dt>Quem faz decide</dt>
                <dd>
                  Preço, página e arquivos são de quem fez o jogo, e as ferramentas dizem com todas as letras o que vai
                  acontecer antes de acontecer.
                </dd>
              </div>
              <div>
                <dt>Pequeno e estranho também é programa</dt>
                <dd>
                  A descoberta favorece o que é novo e diferente, não só o que já vende. Um jogo de um botão divide a
                  página com um de quatro horas.
                </dd>
              </div>
              <div>
                <dt>Honesto por padrão</dt>
                <dd>
                  Sem truques no preço, sem contadores inventados, sem depoimentos de mentira. Quando algo ainda não
                  existe, a página diz isso.
                </dd>
              </div>
            </dl>
          </GuideSection>

          <GuideSection
            id="estado"
            title="O que já existe e o que ainda não"
            intro="O estado de cada parte da VibeGames nesta edição. Nada aqui é promessa de data."
          >
            <table className="state-table">
              <caption className="visually-hidden">Estado de cada parte da VibeGames</caption>
              <thead>
                <tr>
                  <th scope="col">Parte</th>
                  <th scope="col">Estado</th>
                  <th scope="col">O que isso quer dizer</th>
                </tr>
              </thead>
              <tbody>
                {STATUS.map((row) => (
                  <tr key={row.part}>
                    <th scope="row">{row.part}</th>
                    <td>
                      <span className="state" data-state={row.state}>
                        {STATE_LABEL[row.state]}
                      </span>
                    </td>
                    <td>{row.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </GuideSection>

          <nav className="guide-next" aria-label="Para onde seguir">
            <h2>Para onde seguir</h2>
            <ul>
              <li>
                <Link href="/ajuda">
                  <span>Ajuda, por assunto</span>
                  <ArrowRight aria-hidden size={20} />
                </Link>
              </li>
              <li>
                <Link href="/novidades">
                  <span>Novidades do programa</span>
                  <ArrowRight aria-hidden size={20} />
                </Link>
              </li>
              <li>
                <Link href="/jogos">
                  <span>Catálogo completo</span>
                  <ArrowRight aria-hidden size={20} />
                </Link>
              </li>
              <li>
                <Link href="/publicar">
                  <span>Publicar um jogo</span>
                  <ArrowRight aria-hidden size={20} />
                </Link>
              </li>
            </ul>
          </nav>
        </div>
      </div>
    </>
  );
}
