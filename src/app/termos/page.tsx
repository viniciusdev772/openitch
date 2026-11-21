import "@/styles/leitura.css";
import type { Metadata } from "next";
import Link from "next/link";
import { GuideHead, GuideSection } from "@/components/leitura/Guide";
import { Contents } from "@/components/leitura/Contents";
import { RULES } from "@/lib/moderation/rules";
import { MODELS, STRIKES_TO_BAN } from "@/lib/moderation/decide";

export const metadata: Metadata = {
  title: "Termos de uso e regras da comunidade",
  description:
    "As condições para usar o Portal dos Games, as regras do que pode ser publicado, como a moderação automática decide e o que acontece com os seus dados.",
};

const UPDATED = "20 de novembro de 2026";

const SECTIONS = [
  { id: "resumo", label: "Em resumo" },
  { id: "uso", label: "Termos de uso" },
  { id: "regras", label: "Regras da comunidade" },
  { id: "moderacao", label: "Moderação por IA" },
  { id: "recurso", label: "Recurso" },
  { id: "privacidade", label: "Privacidade" },
  { id: "mudancas", label: "Mudanças" },
];

export default function TermosPage() {
  return (
    <>
      <GuideHead title="Termos de uso e regras da comunidade" current="termos">
        <p>
          O que você aceita ao usar o Portal dos Games, o que não pode ser publicado e como as denúncias são julgadas. Em
          vigor desde {UPDATED}.
        </p>
      </GuideHead>

      <div className="wrap guide">
        <aside className="guide-side">
          <Contents title="Nesta página" items={SECTIONS} />
        </aside>

        <div className="guide-col">
          <GuideSection id="resumo" title="Em resumo">
            <div className="guide-prose">
              <ul>
                <li>Para olhar e jogar, você não precisa de conta. Para publicar, guardar jogos ou denunciar, precisa.</li>
                <li>O que você publica continua seu. Você só nos autoriza a mostrar e distribuir enquanto estiver no programa.</li>
                <li>Algumas coisas não podem ser publicadas; a lista está em <a href="#regras">Regras da comunidade</a>.</li>
                <li>
                  Quem julga denúncias é uma análise automática: três modelos de IA votam, e a decisão é aplicada sem pessoa
                  no meio. Toda decisão que fecha uma conta tem direito a um recurso.
                </li>
                <li>O serviço é gratuito, está no começo e é oferecido como está.</li>
              </ul>
            </div>
          </GuideSection>

          <GuideSection id="uso" title="Termos de uso">
            <div className="guide-prose">
              <p>
                <strong>Quem pode usar.</strong> Qualquer pessoa pode visitar e jogar. Para criar conta, é preciso ter 13 anos ou
                mais; abaixo de 18, com autorização de quem é responsável por você. Ao criar a conta, com e-mail ou com outro
                serviço (Google, Resumestre), você aceita estes termos.
              </p>
              <p>
                <strong>Sua conta.</strong> Você responde pelo que é feito com ela. Use uma senha só sua e, se puder, ligue a
                verificação em duas etapas. Uma pessoa banida não pode abrir outra conta para voltar.
              </p>
              <p>
                <strong>O que você publica.</strong> Jogos, textos, imagens e arquivos continuam seus. Ao publicar, você dá ao
                Portal dos Games uma licença gratuita e não exclusiva para guardar, mostrar e distribuir esse material dentro do
                site enquanto ele estiver no programa. Tirou do ar ou excluiu, a licença acaba (os arquivos são apagados na
                exclusão). Você declara que tem o direito de publicar tudo o que envia.
              </p>
              <p>
                <strong>Jogos de outras pessoas.</strong> Os jogos são feitos e enviados por quem publica, não pelo Portal dos
                Games. Baixar e rodar um arquivo é decisão sua. Os jogos de Windows abertos no navegador rodam num emulador
                experimental, isolado do seu computador, e podem não funcionar.
              </p>
              <p>
                <strong>Pagamentos.</strong> Ainda não existem. Nenhum valor é cobrado, e nenhuma tela do site finge concluir
                um pagamento.
              </p>
              <p>
                <strong>Sem garantias.</strong> O serviço é gratuito e oferecido como está. Pode ficar fora do ar, mudar ou
                perder funções. Faça cópia dos seus arquivos: o site não é um backup.
              </p>
              <p>
                <strong>Saída.</strong> Você pode excluir a conta quando quiser, em <Link href="/conta">Sua conta</Link>. A
                moderação pode tirar conteúdo do ar ou fechar contas, do jeito descrito abaixo.
              </p>
            </div>
          </GuideSection>

          <GuideSection
            id="regras"
            title="Regras da comunidade"
            intro="Vale para tudo o que fica público: página do jogo, capa, imagens, arquivos e perfil de criador. Temas difíceis e violência de ficção podem; o que segue, não."
          >
            <dl className="principles">
              {RULES.map((r) => (
                <div key={r.id} id={`regra-${r.id}`}>
                  <dt>{r.title}</dt>
                  <dd>
                    {r.text}
                    {r.zeroTolerance ? " Tolerância zero: a conta é fechada na primeira vez." : ""}
                  </dd>
                </div>
              ))}
            </dl>
            <div className="guide-prose">
              <p>
                Também não pode: driblar um banimento com outra conta, nem fazer denúncias falsas ou em massa para prejudicar
                alguém (as denúncias têm limite por conta e não decidem nada sozinhas, porque os modelos julgam o conteúdo).
              </p>
            </div>
          </GuideSection>

          <GuideSection id="moderacao" title="Moderação por IA">
            <div className="guide-prose">
              <p>
                <strong>Quando acontece.</strong> Quando alguém com conta denuncia um jogo ou um perfil (o link “Denunciar” fica
                na página), e quando um jogo vai entrar no programa: antes de publicar, a página é lida pela mesma análise.
              </p>
              <p>
                <strong>Quem decide.</strong> Três modelos de decisão, de fabricantes diferentes, acessados pelo OpenRouter:{" "}
                {MODELS.map((m, i) => (
                  <span key={m}>
                    <code>{m}</code>
                    {i < MODELS.length - 2 ? ", " : i === MODELS.length - 2 ? " e " : ""}
                  </span>
                ))}
                . Eles não escrevem texto: leem o conteúdo (título, descrição, etiquetas, créditos, nomes dos arquivos, capa e
                até três imagens, ou o perfil) e respondem três perguntas com probabilidades: se alguma regra foi quebrada,
                qual, e quão grave é. A denúncia entra como uma alegação, não como prova.
              </p>
              <p>
                <strong>Como sai a decisão.</strong> Vale a maioria. Só há violação quando a maioria dos modelos vê violação e a
                média passa de 70%. Se menos de dois modelos responderem, nada é decidido e o caso espera.
              </p>
              <ul>
                <li>
                  <strong>Arquivada:</strong> nenhuma regra quebrada, ou algo leve demais para agir. Nada muda.
                </li>
                <li>
                  <strong>Tirado do ar:</strong> violação séria. O jogo volta a ser rascunho (ou o texto do perfil é apagado).
                  Você muda o que quebra a regra e publica de novo; a nova versão passa por outra análise.
                </li>
                <li>
                  <strong>Conta fechada:</strong> violação gravíssima, violação séria de uma regra de tolerância zero, ou a{" "}
                  {STRIKES_TO_BAN}ª remoção em 180 dias. Todos os jogos saem do ar e as sessões são encerradas.
                </li>
              </ul>
              <p>
                <strong>Limites.</strong> Modelos erram, para os dois lados. Por isso são três, a régua para agir é alta, e todo
                fechamento de conta tem recurso. Os modelos não abrem os arquivos dos jogos; um programa malicioso só é pego pelo
                que a página e os nomes dos arquivos mostram, ou pela denúncia de quem jogou.
              </p>
            </div>
          </GuideSection>

          <GuideSection id="recurso" title="Recurso">
            <div className="guide-prose">
              <p>
                Quem tem a conta fechada vê, ao tentar entrar, o aviso com a regra e o voto de cada modelo, e pode mandar um
                recurso: um por decisão, com até 2.000 caracteres. Os mesmos três modelos julgam o caso do zero, com o conteúdo,
                a regra citada e o que você escreveu. Se a maioria não mantiver a decisão, a conta reabre na hora e os jogos que
                saíram com ela voltam ao programa.
              </p>
              <p>
                Isso atende ao direito de pedir a revisão de uma decisão tomada só por tratamento automatizado (Lei Geral de
                Proteção de Dados, art. 20). Para um jogo tirado do ar, o caminho é mudar o conteúdo e publicar de novo.
              </p>
            </div>
          </GuideSection>

          <GuideSection id="privacidade" title="Privacidade">
            <div className="guide-prose">
              <p>
                <strong>O que guardamos.</strong> Nome, e-mail, a senha só como hash (nunca o texto), as sessões abertas (com
                IP, navegador e local aproximado), um registro de segurança da conta (180 dias), seus rascunhos, jogos,
                arquivos e a estante. Se você entra pelo Google ou pelo Resumestre, guardamos o identificador da conta lá.
              </p>
              <p>
                <strong>O que vai para a moderação.</strong> Só conteúdo que já é público ou que você mesmo escreve para a
                análise: a página do jogo ou o perfil, nomes dos arquivos, capa e imagens, o texto das denúncias e o do recurso.
                Isso é enviado ao OpenRouter e aos fabricantes dos modelos citados acima. E-mail, senha, IP e quem fez a denúncia
                nunca são enviados. Quem é denunciado não fica sabendo quem denunciou.
              </p>
              <p>
                <strong>Por quanto tempo.</strong> Denúncias ficam guardadas por 1 ano. Decisões de moderação (com o que foi
                lido e os votos) ficam por 5 anos, para responder a recursos, cumprir a lei e impedir a volta de contas banidas.
                Ao excluir a conta, apagamos conta, sessões, registro, estante, rascunhos, jogos, arquivos e as denúncias que
                você fez.
              </p>
              <p>
                <strong>Onde fica.</strong> O site roda na Vercel; os dados ficam num banco MongoDB; os arquivos, num
                armazenamento compatível com S3 (MinIO). Não vendemos dados nem usamos rastreamento de anúncios.
              </p>
              <p>
                <strong>Seus direitos.</strong> Pela LGPD, você pode ver, corrigir e apagar seus dados. Quase tudo está em{" "}
                <Link href="/conta">Sua conta</Link>: nome, perfil, sessões, registro de segurança e a exclusão da conta.
              </p>
            </div>
          </GuideSection>

          <GuideSection id="mudancas" title="Mudanças nestes termos">
            <div className="guide-prose">
              <p>
                Quando estes termos ou as regras mudarem, a data no topo muda junto. Cada conteúdo é julgado pelas regras em
                vigor no momento da análise.
              </p>
            </div>
          </GuideSection>
        </div>
      </div>
    </>
  );
}
