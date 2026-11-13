import "@/styles/leitura.css";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { GuideHead, GuideSection } from "@/components/leitura/Guide";
import { Contents } from "@/components/leitura/Contents";

export const metadata: Metadata = {
  title: "Como funciona a VibeGames",
  description:
    "O que é a VibeGames, como ela funciona para quem joga, publica ou organiza jams, e o que já funciona hoje.",
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
        <Link href="/conta/projetos">Seus jogos</Link>.
      </>
    ),
  },
  {
    part: "Catálogo, trilhas e filtros",
    state: "sim",
    note: "A busca e os filtros leem os jogos publicados, na ordem em que chegaram.",
  },
  {
    part: "Publicar no programa",
    state: "sim",
    note: "Com a página completa e os arquivos enviados, o rascunho vira entrada numerada, aberta a todos. Por enquanto, só jogos grátis.",
  },
  {
    part: "Jogar no navegador",
    state: "sim",
    note: "A versão de navegador roda numa prévia para quem enviou e, publicada, para qualquer pessoa, sem conta.",
  },
  {
    part: "Envio de arquivos",
    state: "sim",
    note: "Builds de até 3 GB por arquivo, direto do navegador para o armazenamento, em partes e com retomada.",
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
          Um lugar aberto para publicar e jogar jogos independentes. Aqui está o que ele já faz e o que ainda falta.
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
                página, envia os arquivos e o jogo entra no programa. Quem joga abre a página e joga, muitas vezes direto
                no navegador.
              </p>
              <p>
                O site é montado como o programa impresso de um festival que não fecha. Os jogos são entradas
                numeradas, as trilhas têm cor própria e as jams aparecem numa agenda, com hora para começar e acabar.
              </p>
              <p>
                O programa está no começo. Contas, estante, rascunhos, envio de arquivos e publicação já funcionam, e os
                jogos entram no catálogo na ordem em que são publicados.
              </p>
            </div>
          </GuideSection>

          <GuideSection id="para-quem-joga" title="Para quem joga">
            <div className="guide-prose">
              <p>
                Você não precisa de conta para olhar nem para jogar. O <Link href="/jogos">catálogo</Link> se divide em
                cinco trilhas (Navegador, Ação, Narrativo, Quebra-cabeça e Experimental) e tem filtros de plataforma e
                de preço sempre à vista.
              </p>
              <p>
                Hoje todo jogo do programa é grátis, porque os pagamentos ainda não estão ligados. O preço aparece
                na lista e na página do jogo, antes de qualquer clique.
              </p>
              <p>
                Quem publica já pode guardar no rascunho outro modelo de preço (fixo, ou pague o que quiser com um
                mínimo) para quando os pagamentos existirem. Nada disso é cobrado agora.
              </p>
            </div>
          </GuideSection>

          <GuideSection id="para-quem-faz" title="Para quem faz jogos">
            <div className="guide-prose">
              <p>
                Publicar é um formulário de cinco passos: o jogo, a trilha e a capa, as plataformas e os arquivos, o
                preço e a página. Enquanto você escreve, a sua entrada no programa aparece ao lado, do jeito que vai
                ser vista.
              </p>
              <p>
                O rascunho fica salvo na sua conta. Quando a página estiver completa e os arquivos enviados, um clique
                põe o jogo no programa, com número e endereço próprios. Dá para tirar do ar depois. Por enquanto, só
                jogos grátis entram.
              </p>
              <p>
                Para testar o formulário, abra <Link href="/publicar">Publicar</Link>. Para salvar e publicar,{" "}
                <Link href="/criar-conta">crie uma conta</Link>.
              </p>
            </div>
          </GuideSection>

          <GuideSection id="para-quem-organiza" title="Para quem organiza jams">
            <div className="guide-prose">
              <p>
                Uma jam é uma maratona com tema e prazo. Na VibeGames, cada jam tem título, tema, datas de abertura e
                fechamento e uma lista de entradas. Na <Link href="/jams">agenda de jams</Link>, cada uma é uma barra na linha do
                tempo, e uma linha marca o que está acontecendo agora.
              </p>
              <p>
                Na maioria das jams, as entradas entram no programa juntas quando o prazo acaba. Cada jogo leva na
                página o nome da jam de onde veio.
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
                <dd>Cada página existe para levar você ao jogo o mais rápido possível. O resto vem depois.</dd>
              </div>
              <div>
                <dt>Quem faz decide</dt>
                <dd>
                  Quem fez o jogo escolhe o preço e escreve a página. As ferramentas avisam o que vai acontecer antes
                  do clique.
                </dd>
              </div>
              <div>
                <dt>Pequeno e estranho também é programa</dt>
                <dd>
                  O catálogo põe o mais novo no topo, sem ranking. Um jogo de um botão divide a página com um de
                  quatro horas.
                </dd>
              </div>
              <div>
                <dt>Honesto por padrão</dt>
                <dd>
                  Nada de truque no preço nem de número ou depoimento inventado. Quando algo ainda não existe, a página
                  diz isso.
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
