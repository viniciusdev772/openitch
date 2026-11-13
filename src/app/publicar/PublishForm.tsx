"use client";

import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PLATFORMS, TRACKS, formatDay, type Game, type Platform, type TrackId } from "@/data/base";
import { Entry, trackStyle } from "@/components/bits-base";
import DownloadFiles from "@/components/uploads/DownloadFiles";
import { WebBuild } from "@/components/builds/WebBuild";
import { DraftBar, type SaveStatus } from "@/components/projetos/DraftBar";
import { PublishPanel } from "@/components/projetos/PublishPanel";
import { CoverUpload } from "@/components/projetos/CoverUpload";
import { AddressEditor } from "@/components/projetos/AddressEditor";
import { saveDraft } from "@/lib/projects/actions";
import {
  DRAFT_COVERS,
  LIMITS,
  MAX_PRICE_TEXT,
  checkPrice,
  linesProblem,
  parseCents,
  parseCredits,
  splitLines,
  splitTags,
  suggestSlug,
  type DraftFieldKey,
  type DraftFields,
  type PriceKind,
  type SaveResult,
  type SavedDraft,
} from "@/lib/projects/limits";

export type Account = "visitante" | "dentro" | "indisponivel";
export interface JamOption {
  slug: string;
  title: string;
  start: string;
  end: string;
  state: "past" | "live" | "next";
}

type FieldKey = DraftFieldKey;
const FIELD_NAMES: Record<FieldKey, string> = {
  title: "Título",
  tagline: "Frase de apresentação",
  description: "Descrição",
  tags: "Etiquetas",
  amount: "Preço",
  platforms: "Plataformas",
  session: "Duração",
  languages: "Idiomas",
  controls: "Controles",
  accessibility: "Acessibilidade",
  contentNotes: "Avisos de conteúdo",
  credits: "Créditos",
};

/** O que foi escrito sem conta (ou com a sessão vencida), para voltar depois de entrar. */
const STASH = "openitch:publicar:pendente";
const STASH_TTL = 60 * 60 * 1000;

const ALL_PLATFORMS = Object.keys(PLATFORMS) as Platform[];
const NOW_ISO = new Date().toISOString();

const blank = (jam: string): DraftFields => ({
  title: "",
  tagline: "",
  description: "",
  track: "navegador",
  tags: "",
  platforms: [],
  priceKind: "free",
  amount: "5",
  cover: "orbit",
  jam,
  session: "",
  languages: "",
  controls: "",
  accessibility: "",
  contentNotes: "",
  credits: "",
});

const pick = (d: SavedDraft): DraftFields => ({
  title: d.title,
  tagline: d.tagline,
  description: d.description,
  track: d.track,
  tags: d.tags,
  platforms: d.platforms,
  priceKind: d.priceKind,
  amount: d.amount,
  cover: d.cover,
  jam: d.jam,
  session: d.session,
  languages: d.languages,
  controls: d.controls,
  accessibility: d.accessibility,
  contentNotes: d.contentNotes,
  credits: d.credits,
});

const count = (s: string) => [...s].length;

const PRICE_KINDS: PriceKind[] = ["free", "fixed", "pwyw"];
const AMOUNT_MAX = 9;
type LineKey = "controls" | "accessibility" | "contentNotes" | "credits";
const LINE_FIELDS: { key: LineKey; label: string; placeholder: string; hint: string }[] = [
  {
    key: "controls",
    label: "Controles",
    placeholder: "Setas ou A/D: inclina o barco\nEspaço: pula",
    hint: "Um por linha, como Tecla: o que faz. A página desenha as teclas.",
  },
  {
    key: "accessibility",
    label: "Acessibilidade",
    placeholder: "Legendas em todos os diálogos\nJoga com uma mão só",
    hint: "Um recurso por linha.",
  },
  {
    key: "contentNotes",
    label: "Avisos de conteúdo",
    placeholder: "Luzes piscando",
    hint: "Um por linha. Aparecem antes de jogar.",
  },
  {
    key: "credits",
    label: "Créditos",
    placeholder: "Música: Ana Souza\nArte: Beto Lima",
    hint: "Um por linha, como Papel: Nome.",
  },
];

/** O mesmo aviso do servidor, já enquanto escreve (linhas demais, longas demais, crédito sem Papel: Nome). */
function lineHint(key: LineKey, raw: string): string | undefined {
  const items = splitLines(raw);
  const problem = linesProblem(items, LIMITS[key]);
  if (problem) return problem;
  if (key === "credits" && !parseCredits(items)) return "Escreva cada crédito como Papel: Nome, um por linha.";
  return undefined;
}

const LEAVE_WARNING = "Este rascunho tem alterações não salvas. Sair da página mesmo assim? O que não foi salvo se perde.";

/**
 * O que voltou do sessionStorage, conferido campo a campo com as mesmas
 * listas e limites do formulário. Um campo que não passa fica com o valor de
 * `base`; o resto volta. null quando nem é um objeto.
 */
function fromStash(raw: unknown, base: DraftFields, jamSlugs: Set<string>): DraftFields | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, unknown>;
  const text = (v: unknown, max: number, fallback: string) => (typeof v === "string" ? [...v].slice(0, max).join("") : fallback);
  return {
    title: text(s.title, LIMITS.title, base.title),
    tagline: text(s.tagline, LIMITS.tagline, base.tagline),
    description: text(s.description, LIMITS.description, base.description),
    track: TRACKS.some((t) => t.id === s.track) ? (s.track as TrackId) : base.track,
    tags: text(s.tags, LIMITS.tagsRaw, base.tags),
    platforms: Array.isArray(s.platforms) ? ALL_PLATFORMS.filter((p) => (s.platforms as unknown[]).includes(p)) : base.platforms,
    priceKind: PRICE_KINDS.includes(s.priceKind as PriceKind) ? (s.priceKind as PriceKind) : base.priceKind,
    // O mesmo filtro do campo: só algarismos, vírgula e ponto, até 9 caracteres.
    amount: typeof s.amount === "string" && s.amount.length <= AMOUNT_MAX && /^[\d,.]*$/.test(s.amount) ? s.amount : base.amount,
    cover: DRAFT_COVERS.some((c) => c.style === s.cover) ? (s.cover as DraftFields["cover"]) : base.cover,
    jam: typeof s.jam === "string" && (s.jam === "" || jamSlugs.has(s.jam)) ? s.jam : base.jam,
    session: text(s.session, LIMITS.session, base.session),
    languages: text(s.languages, LIMITS.languagesRaw, base.languages),
    controls: text(s.controls, LIMITS.controls.lines * (LIMITS.controls.line + 1), base.controls),
    accessibility: text(s.accessibility, LIMITS.accessibility.lines * (LIMITS.accessibility.line + 1), base.accessibility),
    contentNotes: text(s.contentNotes, LIMITS.contentNotes.lines * (LIMITS.contentNotes.line + 1), base.contentNotes),
    credits: text(s.credits, LIMITS.credits.lines * (LIMITS.credits.line + 1), base.credits),
  };
}

interface FormProps {
  account: Account;
  initial: SavedDraft | null;
  jam: string;
  jams: JamOption[];
  missing: boolean;
}

/**
 * Dá ao formulário a sua chave. O servidor manda a chave do que o endereço
 * abre ("rascunho:<id>" ou "novo:<jam>"): mudar de chave recomeça o
 * formulário, e um novo render do servidor do mesmo endereço não muda nada.
 *
 * Exceção: o rascunho que o próprio formulário criou. Ao salvar pela primeira
 * vez, o endereço passa a ?projeto=<id> sem passar pelo servidor; enquanto o
 * endereço apontar para esse id, é o mesmo formulário (mesma chave), mesmo que
 * o servidor o renderize de novo como "rascunho:<id>". Quando o endereço sai
 * dele (o Publicar do cabeçalho, por exemplo, volta a "novo:"), o formulário
 * recomeça, ainda que a chave do servidor seja igual à de antes.
 */
export function PublishFormHost({ formKey, ...props }: FormProps & { formKey: string }) {
  const urlId = useSearchParams().get("projeto");
  const [own, setOwn] = useState<{ id: string; key: string; shown: boolean } | null>(null);
  // O endereço só acompanha o replaceState um instante depois; até lá, a chave fica.
  if (own && !own.shown && urlId === own.id) setOwn({ ...own, shown: true });
  const key = !own || !own.shown || urlId === own.id ? (own?.key ?? formKey) : formKey === own.key ? `${formKey}|${own.id}` : formKey;
  return <PublishForm key={key} {...props} onCreated={(id) => setOwn({ id, key, shown: false })} />;
}

function PublishForm({
  account,
  initial,
  jam,
  jams,
  missing,
  onCreated,
}: FormProps & {
  /** O primeiro salvamento de um rascunho novo (ou "salvar como novo") criou este id. */
  onCreated: (id: string) => void;
}) {
  const id = useId();
  const [f, setF] = useState<DraftFields>(() => (initial ? pick(initial) : blank(jam)));
  const [draftId, setDraftId] = useState<string | null>(initial?.id ?? null);
  const [savedAt, setSavedAt] = useState<string | null>(initial?.updatedAt ?? null);
  const [savedSnap, setSavedSnap] = useState<string | null>(() => (initial ? JSON.stringify(pick(initial)) : null));
  const [status, setStatus] = useState<SaveStatus>({ kind: "idle" });
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [tried, setTried] = useState(false);
  const [restored, setRestored] = useState(false);
  const [pending, startTransition] = useTransition();
  // Qual rascunho está no ar (o passo 6 fica feito só para ele).
  const [liveId, setLiveId] = useState<string | null>(initial?.state === "publicado" ? initial.id : null);
  const [coverImage, setCoverImage] = useState<string | null>(initial?.coverImage ?? null);
  const [publicSlug, setPublicSlug] = useState<string | null>(initial?.publicSlug ?? null);
  const refs = useRef<Partial<Record<FieldKey, HTMLElement | null>>>({});

  const snap = JSON.stringify(f);
  const dirty = savedSnap === null ? snap !== JSON.stringify(blank(jam)) : snap !== savedSnap;

  /* Volta o que estava escrito antes de entrar (mesmo rascunho, ou rascunho novo). */
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STASH);
      if (!raw) return;
      const s = JSON.parse(raw) as { at?: unknown; id?: unknown; fields?: unknown } | null;
      if (typeof s?.at !== "number" || Date.now() - s.at > STASH_TTL) {
        sessionStorage.removeItem(STASH);
        return;
      }
      if ((s.id ?? null) !== (initial?.id ?? null)) return;
      sessionStorage.removeItem(STASH);
      const fields = fromStash(s.fields, initial ? pick(initial) : blank(jam), new Set(jams.map((j) => j.slug)));
      if (!fields) return;
      setF(fields);
      setRestored(true);
    } catch {
      /* armazenamento bloqueado ou conteúdo ilegível: segue sem recuperar */
    }
    // Só ao abrir este rascunho (ou rascunho novo): um novo render do servidor não volta a restaurar.
  }, [initial?.id, jam]);

  /*
   * Sair da página com alterações não salvas pede confirmação: fechar,
   * recarregar ou ir para outro site (beforeunload), e também seguir um link
   * interno, que o Next abre sem recarregar. O clique é visto na captura, antes
   * do <Link>; recusado, ele não chega ao roteador. Links que guardam o texto
   * antes de sair (entrar de novo) e cliques que abrem outra aba passam direto.
   */
  useEffect(() => {
    if (account !== "dentro" || !dirty) return;
    // Saída já confirmada num link: enquanto a próxima página carrega, não pergunta de novo.
    let leaving = false;
    const warn = (e: BeforeUnloadEvent) => {
      if (!leaving) e.preventDefault();
    };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target instanceof Element ? e.target.closest("a[href]") : null;
      if (!(a instanceof HTMLAnchorElement) || a.hasAttribute("data-keeps-draft") || a.hasAttribute("download")) return;
      if (a.target && a.target !== "_self") return;
      const to = new URL(a.href, window.location.href);
      if (to.origin !== window.location.origin) return; // outro site: o beforeunload pergunta
      if (to.pathname === window.location.pathname && to.search === window.location.search) return; // só a âncora muda
      if (window.confirm(LEAVE_WARNING)) {
        leaving = true;
        return;
      }
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener("beforeunload", warn);
    window.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      window.removeEventListener("click", onClick, true);
    };
  }, [account, dirty]);

  const stash = () => {
    try {
      sessionStorage.setItem(STASH, JSON.stringify({ at: Date.now(), id: draftId, fields: f }));
    } catch {
      /* sem armazenamento: nada a fazer */
    }
  };

  const set = <K extends keyof DraftFields>(key: K, value: DraftFields[K], field?: FieldKey) => {
    setF((cur) => ({ ...cur, [key]: value }));
    if (field && errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
    if (status.kind === "saved") setStatus({ kind: "idle" });
  };

  /* Prévia: a mesma entrada do programa, montada com o que está no formulário. */
  const cents = f.priceKind === "free" ? 0 : (parseCents(f.amount) ?? 0);
  const cover = DRAFT_COVERS.find((c) => c.style === f.cover) ?? DRAFT_COVERS[0];
  const preview: Game = useMemo(
    () => ({
      slug: "rascunho",
      number: 17,
      title: f.title.trim() || "Seu jogo aqui",
      tagline: f.tagline.trim() || "Uma frase que faz alguém querer jogar.",
      description: [f.description],
      creator: "Você",
      track: f.track,
      tags: splitTags(f.tags),
      platforms: f.platforms,
      price:
        f.priceKind === "free"
          ? { kind: "free" }
          : f.priceKind === "fixed"
            ? { kind: "fixed", amount: cents / 100 }
            : { kind: "pwyw", minimum: cents / 100 },
      published: NOW_ISO,
      updated: NOW_ISO,
      session: "",
      languages: [],
      cover: cover.style,
      palette: cover.palette,
      coverImage: coverImage ?? undefined,
      downloads: [],
    }),
    [f, cents, cover, coverImage],
  );

  // A mesma conferência do servidor (checkPrice), com as mesmas mensagens.
  const priceCheck = checkPrice(f.priceKind, f.amount);
  const priceProblem = priceCheck.ok ? null : priceCheck.error;

  const done = {
    1: count(f.title.trim()) >= 2 && count(f.tagline.trim()) >= 5,
    2: true,
    3: f.platforms.length > 0,
    4: priceProblem === null,
    5: count(f.description.trim()) > 20,
  };
  const open = Object.values(done).filter((d) => !d).length;

  const titleError = errors.title ?? (tried && count(f.title.trim()) < 2 ? "Dê um nome ao jogo, com pelo menos 2 letras, para salvar o rascunho." : undefined);
  const amountError = errors.amount ?? (f.amount !== "" || f.priceKind === "fixed" ? (priceProblem ?? undefined) : undefined);

  const focusField = (k: FieldKey) => refs.current[k]?.focus();

  const save = (opts: { asNew?: boolean } = {}) => {
    if (account !== "dentro" || pending) return;
    if (count(f.title.trim()) < 2) {
      setTried(true);
      setStatus({ kind: "error", code: "campos", message: "Dê um nome ao jogo para salvar o rascunho.", fields: ["title"] });
      focusField("title");
      return;
    }
    const target = opts.asNew ? null : draftId;
    const sent = snap;
    const fd = new FormData();
    if (target) fd.set("id", target);
    fd.set("titulo", f.title);
    fd.set("frase", f.tagline);
    fd.set("descricao", f.description);
    fd.set("etiquetas", f.tags);
    fd.set("trilha", f.track);
    fd.set("capa", f.cover);
    fd.set("preco", f.priceKind);
    fd.set("valor", f.amount);
    fd.set("jam", f.jam);
    fd.set("duracao", f.session);
    fd.set("idiomas", f.languages);
    fd.set("controles", f.controls);
    fd.set("acessibilidade", f.accessibility);
    fd.set("avisos", f.contentNotes);
    fd.set("creditos", f.credits);
    for (const p of f.platforms) fd.append("plataforma", p);
    setStatus({ kind: "saving" });
    startTransition(async () => {
      let res: SaveResult;
      try {
        res = await saveDraft(fd);
      } catch {
        res = {
          ok: false,
          code: "servidor",
          error: "Sem conexão com o servidor. O que você escreveu continua aqui: tente de novo em instantes.",
        };
      }
      if (res.ok) {
        setDraftId(res.id);
        setSavedAt(res.savedAt);
        setSavedSnap(sent);
        setErrors({});
        setStatus({ kind: "saved" });
        try {
          sessionStorage.removeItem(STASH);
        } catch {
          /* nada */
        }
        // O endereço passa a apontar para o rascunho: recarregar reabre ele.
        if (!target) {
          onCreated(res.id);
          window.history.replaceState(null, "", `/publicar?projeto=${res.id}`);
        }
        return;
      }
      if (res.code === "sessao") stash();
      const fields = (res.fields ?? {}) as Partial<Record<FieldKey, string>>;
      setErrors(fields);
      setStatus({ kind: "error", code: res.code, message: res.error, fields: Object.keys(fields) as FieldKey[] });
    });
  };

  const t = TRACKS.find((x) => x.id === f.track)!;
  const jamInfo = jams.find((j) => j.slug === f.jam);
  const nextPath = draftId ? `/publicar?projeto=${draftId}` : f.jam ? `/publicar?jam=${encodeURIComponent(f.jam)}` : "/publicar";

  const describe = (...ids: (string | false | undefined)[]) => ids.filter(Boolean).join(" ") || undefined;

  const bar = (
    <DraftBar
      account={account}
      status={status}
      dirty={dirty}
      saved={savedAt}
      isNew={!draftId}
      busy={pending}
      nextPath={nextPath}
      fieldNames={FIELD_NAMES}
      onSave={() => save()}
      onSaveAsNew={() => save({ asNew: true })}
      onFocusField={(k) => focusField(k as FieldKey)}
      onLeave={stash}
      live={liveId !== null && liveId === draftId}
    />
  );

  return (
    <form
      className="wrap publish"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
          e.preventDefault();
          save();
        }
      }}
    >
      <div className="publish-main">
        {missing ? (
          <p className="bo-alert pj-note" role="alert">
            Não encontramos esse rascunho na sua conta. O formulário abaixo começa um rascunho novo.
          </p>
        ) : null}
        {restored ? (
          <p className="bo-ok pj-note" role="status">
            Recuperamos o que você tinha escrito antes de entrar. Confira e salve.
          </p>
        ) : null}
        {account === "visitante" ? (
          <div className="pj-gate">
            <p>
              <strong>Você pode testar tudo sem conta.</strong> Para salvar como rascunho e voltar depois, entre na sua
              conta. O que já estiver escrito vem junto.
            </p>
            <Link href={`/entrar?de=${encodeURIComponent(nextPath)}`} className="btn btn--sm" onClick={stash} data-keeps-draft>
              Entrar para salvar
            </Link>
          </div>
        ) : null}

        <ol className="steps">
          <li className="step" data-done={done[1]}>
            <span className="step-num" aria-hidden>1</span>
            <div>
              <h2>O jogo</h2>
              <p>Nome e uma frase. É o que aparece no programa antes de qualquer clique.</p>
              <div className="stack">
                <div>
                  <label className="field-label" htmlFor={`${id}-t`}>Título</label>
                  <input
                    id={`${id}-t`}
                    ref={(el) => {
                      refs.current.title = el;
                    }}
                    className="input"
                    value={f.title}
                    maxLength={LIMITS.title}
                    onChange={(e) => set("title", e.target.value, "title")}
                    placeholder="Ex.: Barco de Papel"
                    aria-invalid={titleError ? true : undefined}
                    aria-describedby={describe(titleError && `${id}-t-err`, `${id}-t-hint`)}
                  />
                  {titleError ? (
                    <p className="field-error" id={`${id}-t-err`}>{titleError}</p>
                  ) : null}
                  {publicSlug && draftId && account === "dentro" ? (
                    <>
                      <p className="field-hint" id={`${id}-t-hint`}>
                        O endereço não muda quando o título muda.
                      </p>
                      <AddressEditor draftId={draftId} slug={publicSlug} onChange={setPublicSlug} />
                    </>
                  ) : (
                    <p className="field-hint" id={`${id}-t-hint`}>
                      {f.title.trim() ? (
                        <>
                          Endereço sugerido: <span className="pj-slug">/jogo/{suggestSlug(f.title) || "…"}</span>. Ele fica
                          reservado quando você publica, e dá para trocar depois.
                        </>
                      ) : (
                        "Só o título já basta para salvar um rascunho."
                      )}
                    </p>
                  )}
                </div>
                <div>
                  <label className="field-label" htmlFor={`${id}-g`}>Frase de apresentação</label>
                  <input
                    id={`${id}-g`}
                    ref={(el) => {
                      refs.current.tagline = el;
                    }}
                    className="input"
                    value={f.tagline}
                    maxLength={LIMITS.tagline}
                    onChange={(e) => set("tagline", e.target.value, "tagline")}
                    placeholder="Desça a sarjeta depois da chuva sem afundar."
                    aria-invalid={errors.tagline ? true : undefined}
                    aria-describedby={describe(errors.tagline && `${id}-g-err`, `${id}-g-hint`)}
                  />
                  {errors.tagline ? <p className="field-error" id={`${id}-g-err`}>{errors.tagline}</p> : null}
                  <p className="field-hint" id={`${id}-g-hint`}>
                    <span className="num">{LIMITS.tagline - count(f.tagline)}</span> caracteres restantes.
                  </p>
                </div>
                <div>
                  <label className="field-label" htmlFor={`${id}-j`}>Jam (opcional)</label>
                  <select
                    disabled={jams.length === 0 && !f.jam}
                    id={`${id}-j`}
                    className="input pj-select"
                    value={f.jam}
                    onChange={(e) => set("jam", e.target.value)}
                    aria-describedby={`${id}-j-hint`}
                  >
                    <option value="">Nenhuma jam</option>
                    {jams.map((j) => (
                      <option key={j.slug} value={j.slug}>
                        {j.title}
                        {j.state === "live"
                          ? ` · aberta até ${formatDay(j.end)}`
                          : j.state === "next"
                            ? ` · abre em ${formatDay(j.start)}`
                            : " · encerrada"}
                      </option>
                    ))}
                  </select>
                  <p className="field-hint" id={`${id}-j-hint`}>
                    {jamInfo
                      ? jamInfo.state === "past"
                        ? "Essa jam já fechou. O rascunho guarda a escolha, mas ela não recebe mais jogos."
                        : "Um rascunho não conta como envio: a jam só recebe o jogo depois que ele é publicado."
                      : jams.length === 0
                        ? "Nenhuma jam está marcada agora. Quando houver uma, ela aparece aqui."
                        : "Se o jogo é para uma jam, escolha aqui. Dá para mudar depois."}
                  </p>
                </div>
              </div>
            </div>
          </li>

          <li className="step" data-done={done[2]}>
            <span className="step-num" aria-hidden>2</span>
            <div>
              <h2>Trilha e capa</h2>
              <p>A trilha define a cor da sua seção no programa. A capa provisória fica até você ter uma imagem.</p>
              <div className="stack">
                <fieldset className="pj-fieldset">
                  <legend className="field-label">Trilha</legend>
                  <div className="track-toggles pj-tracks">
                    {TRACKS.map((x) => (
                      <button
                        key={x.id}
                        type="button"
                        className="track-toggle"
                        style={trackStyle(x.id)}
                        aria-pressed={f.track === x.id}
                        onClick={() => set("track", x.id as TrackId)}
                      >
                        <span><i aria-hidden />{x.name}</span>
                      </button>
                    ))}
                  </div>
                </fieldset>
                <fieldset className="pj-fieldset">
                  <legend className="field-label">Imagem de capa</legend>
                  <CoverUpload draftId={account === "dentro" ? draftId : null} url={coverImage} onChange={setCoverImage} />
                </fieldset>
                <fieldset className="pj-fieldset">
                  <legend className="field-label">{coverImage ? "Capa provisória (se tirar a imagem)" : "Capa provisória"}</legend>
                  <div className="seg">
                    {DRAFT_COVERS.map((c) => (
                      <button key={c.style} type="button" aria-pressed={f.cover === c.style} onClick={() => set("cover", c.style)}>
                        {c.name}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <div>
                  <label className="field-label" htmlFor={`${id}-tags`}>Etiquetas</label>
                  <input
                    id={`${id}-tags`}
                    ref={(el) => {
                      refs.current.tags = el;
                    }}
                    className="input"
                    value={f.tags}
                    maxLength={LIMITS.tagsRaw}
                    onChange={(e) => set("tags", e.target.value, "tags")}
                    placeholder="plataforma, chuva, curto"
                    aria-invalid={errors.tags ? true : undefined}
                    aria-describedby={describe(errors.tags && `${id}-tags-err`, `${id}-tags-hint`)}
                  />
                  {errors.tags ? <p className="field-error" id={`${id}-tags-err`}>{errors.tags}</p> : null}
                  <p className="field-hint" id={`${id}-tags-hint`}>
                    Separe por vírgulas, com até <span className="num">{LIMITS.tag}</span> caracteres cada. Elas viram filtros no
                    catálogo. <span className="num">{splitTags(f.tags).length}</span> de <span className="num">{LIMITS.tags}</span>.
                  </p>
                </div>
              </div>
            </div>
          </li>

          <li className="step" data-done={done[3]}>
            <span className="step-num" aria-hidden>3</span>
            <div>
              <h2>Plataformas e arquivos</h2>
              <p>
                Marque onde o jogo roda. Cada plataforma recebe um arquivo: um .zip com index.html para o navegador, ou o
                executável de cada sistema.
              </p>
              <div className="stack">
                <fieldset className="pj-fieldset">
                  <legend className="field-label">Plataformas</legend>
                  <div
                    className="platform-toggles"
                    ref={(el) => {
                      refs.current.platforms = el?.querySelector("button") ?? null;
                    }}
                  >
                    {ALL_PLATFORMS.map((p) => {
                      const on = f.platforms.includes(p);
                      return (
                        <button
                          key={p}
                          type="button"
                          className="platform-toggle"
                          aria-pressed={on}
                          onClick={() =>
                            set("platforms", on ? f.platforms.filter((x) => x !== p) : ALL_PLATFORMS.filter((x) => x === p || f.platforms.includes(x)), "platforms")
                          }
                        >
                          <span className="code" aria-hidden>{PLATFORMS[p].code}</span>
                          {PLATFORMS[p].name}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
                {/* Os arquivos vão do navegador direto para o armazenamento; a página só assina. */}
                {f.platforms.includes("web") ? (
                  account === "dentro" && draftId ? (
                    <WebBuild projectId={draftId} />
                  ) : (
                    <p className="field-hint">Salve o rascunho para enviar a versão de navegador (zip ou pasta do build).</p>
                  )
                ) : null}
                <DownloadFiles projectId={account === "dentro" ? draftId : null} platforms={f.platforms} />
              </div>
            </div>
          </li>

          <li className="step" data-done={done[4]}>
            <span className="step-num" aria-hidden>4</span>
            <div>
              <h2>Preço</h2>
              <p>
                Você escolhe o modelo e o valor. Os pagamentos ainda não estão ligados, então por enquanto só jogos
                grátis entram no programa; o rascunho guarda qualquer preço para depois.
              </p>
              <div className="stack">
                <div className="seg" role="radiogroup" aria-label="Modelo de preço">
                  {(
                    [
                      ["free", "Grátis"],
                      ["fixed", "Preço fixo"],
                      ["pwyw", "Pague o que quiser"],
                    ] as [PriceKind, string][]
                  ).map(([k, l]) => (
                    <button key={k} type="button" role="radio" aria-checked={f.priceKind === k} onClick={() => set("priceKind", k, "amount")}>
                      {l}
                    </button>
                  ))}
                </div>
                {f.priceKind !== "free" && (
                  <div>
                    <label className="field-label" htmlFor={`${id}-p`}>
                      {f.priceKind === "fixed" ? "Preço" : "Mínimo (0 deixa livre)"}
                    </label>
                    <div className="money">
                      <span aria-hidden>R$</span>
                      <input
                        id={`${id}-p`}
                        ref={(el) => {
                          refs.current.amount = el;
                        }}
                        className="input"
                        inputMode="decimal"
                        maxLength={9}
                        value={f.amount}
                        onChange={(e) => set("amount", e.target.value.replace(/[^\d,.]/g, ""), "amount")}
                        aria-invalid={amountError ? true : undefined}
                        aria-describedby={describe(amountError && `${id}-p-err`, `${id}-p-hint`)}
                      />
                    </div>
                    {amountError ? <p className="field-error" id={`${id}-p-err`}>{amountError}</p> : null}
                    <p className="field-hint" id={`${id}-p-hint`}>
                      Em reais, até <span className="num">{MAX_PRICE_TEXT}</span>. Use vírgula para os centavos.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </li>

          <li className="step" data-done={done[5]}>
            <span className="step-num" aria-hidden>5</span>
            <div>
              <h2>A página</h2>
              <p>Conte o que é o jogo, quanto tempo dura e para quem é. Texto simples, parágrafos separados por linha em branco.</p>
              <label className="field-label" htmlFor={`${id}-d`}>Descrição</label>
              <textarea
                id={`${id}-d`}
                ref={(el) => {
                  refs.current.description = el;
                }}
                className="textarea"
                value={f.description}
                maxLength={LIMITS.description}
                onChange={(e) => set("description", e.target.value, "description")}
                placeholder="Você é um barco de papel na primeira chuva de março..."
                aria-invalid={errors.description ? true : undefined}
                aria-describedby={describe(errors.description && `${id}-d-err`, `${id}-d-hint`)}
              />
              {errors.description ? <p className="field-error" id={`${id}-d-err`}>{errors.description}</p> : null}
              <p className="field-hint" id={`${id}-d-hint`}>
                <span className="num">{count(f.description).toLocaleString("pt-BR")}</span> de{" "}
                <span className="num">{LIMITS.description.toLocaleString("pt-BR")}</span> caracteres.
              </p>

              <div className="pj-details">
                <h3>Detalhes da página</h3>
                <p className="field-hint">Todos opcionais. Cada um que você preencher aparece na página do jogo.</p>
                <div className="pj-details-pair">
                  <div>
                    <label className="field-label" htmlFor={`${id}-dur`}>Duração</label>
                    <input
                      id={`${id}-dur`}
                      ref={(el) => {
                        refs.current.session = el;
                      }}
                      className="input"
                      value={f.session}
                      maxLength={LIMITS.session}
                      onChange={(e) => set("session", e.target.value, "session")}
                      placeholder="10 minutos"
                      aria-invalid={errors.session ? true : undefined}
                      aria-describedby={describe(errors.session && `${id}-dur-err`)}
                    />
                    {errors.session ? <p className="field-error" id={`${id}-dur-err`}>{errors.session}</p> : null}
                  </div>
                  <div>
                    <label className="field-label" htmlFor={`${id}-lang`}>Idiomas</label>
                    <input
                      id={`${id}-lang`}
                      ref={(el) => {
                        refs.current.languages = el;
                      }}
                      className="input"
                      value={f.languages}
                      maxLength={LIMITS.languagesRaw}
                      onChange={(e) => set("languages", e.target.value, "languages")}
                      placeholder="Português, Inglês"
                      aria-invalid={errors.languages ? true : undefined}
                      aria-describedby={describe(errors.languages && `${id}-lang-err`, `${id}-lang-hint`)}
                    />
                    {errors.languages ? <p className="field-error" id={`${id}-lang-err`}>{errors.languages}</p> : null}
                    <p className="field-hint" id={`${id}-lang-hint`}>Separados por vírgula.</p>
                  </div>
                </div>
                {LINE_FIELDS.map((lf) => {
                  const lineError = errors[lf.key] ?? lineHint(lf.key, f[lf.key]);
                  return (
                    <div key={lf.key}>
                      <label className="field-label" htmlFor={`${id}-${lf.key}`}>{lf.label}</label>
                      <textarea
                        id={`${id}-${lf.key}`}
                        ref={(el) => {
                          refs.current[lf.key] = el;
                        }}
                        className="textarea pj-lines"
                        rows={3}
                        value={f[lf.key]}
                        onChange={(e) => set(lf.key, e.target.value, lf.key)}
                        placeholder={lf.placeholder}
                        aria-invalid={lineError ? true : undefined}
                        aria-describedby={describe(lineError && `${id}-${lf.key}-err`, `${id}-${lf.key}-hint`)}
                      />
                      {lineError ? <p className="field-error" id={`${id}-${lf.key}-err`}>{lineError}</p> : null}
                      <p className="field-hint" id={`${id}-${lf.key}-hint`}>{lf.hint}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </li>

          <li className="step" data-done={liveId !== null && liveId === draftId}>
            <span className="step-num" aria-hidden>6</span>
            <div>
              <h2>No programa</h2>
              <p>
                {open === 0
                  ? "Os cinco passos estão completos."
                  : `${open} ${open === 1 ? "passo ainda em aberto" : "passos ainda em aberto"} acima.`}{" "}
                Publicado, o jogo ganha número e endereço próprios e abre para todos, com ou sem conta. Dá para tirar do
                ar quando quiser.
              </p>
              <PublishPanel
                // Outro rascunho (ex.: "salvar como novo"): outro painel, que começa como rascunho.
                key={draftId ?? "novo"}
                signedIn={account === "dentro"}
                draftId={draftId}
                fields={{ title: f.title, tagline: f.tagline, description: f.description, platforms: f.platforms, priceKind: f.priceKind }}
                dirty={dirty}
                savedAt={savedAt}
                initial={
                  initial && initial.id === draftId
                    ? { state: initial.state, slug: initial.publicSlug, number: initial.number }
                    : { state: "rascunho", slug: null, number: null }
                }
                onFocusField={(k) => focusField(k)}
                slug={publicSlug}
                onLiveChange={(on, slug) => {
                  setLiveId(on ? draftId : null);
                  if (slug) setPublicSlug(slug);
                }}
              />
            </div>
          </li>
        </ol>
      </div>

      <aside className="preview-col" aria-label="Prévia da entrada e rascunho">
        {bar}
        <div className="pj-preview">
          <div className="label">
            <span>Sua entrada no programa</span>
            <span>{t.name}</span>
          </div>
          <div className={`preview-sheet${t.on === "--paper" ? " on-field" : ""}`} style={trackStyle(f.track)}>
            <Entry game={preview} variant="lead" link={false} creatorName="Você" />
          </div>
        </div>
      </aside>
    </form>
  );
}
