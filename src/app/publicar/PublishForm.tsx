"use client";

import { useId, useRef, useState } from "react";
import { Trash2, UploadCloud } from "lucide-react";
import {
  PLATFORMS,
  TRACKS,
  type CoverStyle,
  type Game,
  type Platform,
  type Price,
  type TrackId,
} from "@/data/catalog";
import { Entry, trackStyle } from "@/components/bits";

interface FileRow {
  name: string;
  size: number;
  platform: Platform;
}

const COVERS: { style: CoverStyle; palette: [string, string, string]; name: string }[] = [
  { style: "orbit", palette: ["--ultra", "--lime", "--paper"], name: "Órbita" },
  { style: "beam", palette: ["--ink", "--tangerine", "--paper"], name: "Farol" },
  { style: "weave", palette: ["--paper", "--magenta", "--ultra"], name: "Trama" },
  { style: "tide", palette: ["--teal", "--lime", "--ink"], name: "Maré" },
];

function guessPlatform(name: string): Platform {
  const n = name.toLowerCase();
  if (n.endsWith(".apk")) return "android";
  if (n.endsWith(".dmg") || n.includes("mac")) return "macos";
  if (n.includes("linux") || n.endsWith(".tar.gz") || n.endsWith(".appimage")) return "linux";
  if (n.endsWith(".exe") || n.includes("win")) return "windows";
  return "web";
}

const fmtSize = (b: number) => (b > 1e6 ? `${(b / 1e6).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(b / 1e3))} KB`);

export function PublishForm() {
  const id = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [tagline, setTagline] = useState("");
  const [track, setTrack] = useState<TrackId>("navegador");
  const [tags, setTags] = useState("");
  const [files, setFiles] = useState<FileRow[]>([]);
  const [over, setOver] = useState(false);
  const [priceKind, setPriceKind] = useState<Price["kind"]>("free");
  const [amount, setAmount] = useState("5");
  const [description, setDescription] = useState("");
  const [cover, setCover] = useState(0);
  const [published, setPublished] = useState(false);
  const [tried, setTried] = useState(false);

  const n = Math.max(0, Number(amount.replace(",", ".")) || 0);
  const price: Price = priceKind === "free" ? { kind: "free" } : priceKind === "fixed" ? { kind: "fixed", amount: n } : { kind: "pwyw", minimum: n };
  const platforms = files.length ? Array.from(new Set(files.map((f) => f.platform))) : (["web"] as Platform[]);

  const draft: Game = {
    slug: "rascunho",
    number: 17,
    title: title.trim() || "Seu jogo aqui",
    tagline: tagline.trim() || "Uma frase que faz alguém querer jogar.",
    description: [description],
    creator: "Você",
    track,
    tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
    platforms,
    price,
    published: new Date().toISOString(),
    updated: new Date().toISOString(),
    session: "",
    languages: [],
    cover: COVERS[cover].style,
    palette: COVERS[cover].palette,
    downloads: [],
  };

  const done = {
    1: title.trim().length > 1 && tagline.trim().length > 4,
    2: true,
    3: files.length > 0,
    4: priceKind === "free" || n > 0 || priceKind === "pwyw",
    5: description.trim().length > 20,
  };
  const ready = Object.values(done).every(Boolean);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    setFiles((cur) => [...cur, ...Array.from(list).map((f) => ({ name: f.name, size: f.size, platform: guessPlatform(f.name) }))]);
    setPublished(false);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (ready) setPublished(true);
  };

  const t = TRACKS.find((x) => x.id === track)!;

  return (
    <form className="wrap publish" onSubmit={submit} noValidate>
      <ol className="steps">
        <li className="step" data-done={done[1]}>
          <span className="step-num" aria-hidden>1</span>
          <div>
            <h2>O jogo</h2>
            <p>Nome e uma frase. É o que aparece no programa antes de qualquer clique.</p>
            <div className="stack">
              <div>
                <label className="field-label" htmlFor={`${id}-t`}>Título</label>
                <input id={`${id}-t`} className="input" value={title} maxLength={40} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Barco de Papel" aria-invalid={tried && title.trim().length < 2} />
                {tried && title.trim().length < 2 && <p className="publish-error">Dê um nome ao jogo.</p>}
              </div>
              <div>
                <label className="field-label" htmlFor={`${id}-g`}>Frase de apresentação</label>
                <input id={`${id}-g`} className="input" value={tagline} maxLength={90} onChange={(e) => setTagline(e.target.value)} placeholder="Desça a sarjeta depois da chuva sem afundar." />
                <p className="field-hint">{90 - tagline.length} caracteres restantes.</p>
              </div>
            </div>
          </div>
        </li>

        <li className="step" data-done={done[2]}>
          <span className="step-num" aria-hidden>2</span>
          <div>
            <h2>Trilha e capa</h2>
            <p>A trilha define a cor da sua seção no programa. A capa provisória fica até você enviar uma imagem.</p>
            <div className="stack">
              <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
                <legend className="field-label">Trilha</legend>
                <div className="track-toggles" style={{ flexDirection: "row", flexWrap: "wrap" }}>
                  {TRACKS.map((x) => (
                    <button key={x.id} type="button" className="track-toggle" style={{ ...trackStyle(x.id), width: "auto" }} aria-pressed={track === x.id} onClick={() => setTrack(x.id)}>
                      <span><i aria-hidden />{x.name}</span>
                    </button>
                  ))}
                </div>
              </fieldset>
              <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
                <legend className="field-label">Capa provisória</legend>
                <div className="seg">
                  {COVERS.map((c, i) => (
                    <button key={c.style} type="button" aria-pressed={cover === i} onClick={() => setCover(i)}>{c.name}</button>
                  ))}
                </div>
              </fieldset>
              <div>
                <label className="field-label" htmlFor={`${id}-tags`}>Tags</label>
                <input id={`${id}-tags`} className="input" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="plataforma, chuva, curto" />
                <p className="field-hint">Separe por vírgulas. Elas viram filtros no catálogo.</p>
              </div>
            </div>
          </div>
        </li>

        <li className="step" data-done={done[3]}>
          <span className="step-num" aria-hidden>3</span>
          <div>
            <h2>Arquivos</h2>
            <p>Um .zip com index.html roda no navegador. Executáveis e instaladores viram downloads, um por plataforma.</p>
            <div
              className="dropzone"
              data-over={over}
              role="button"
              tabIndex={0}
              onClick={() => fileRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  fileRef.current?.click();
                }
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(true);
              }}
              onDragLeave={() => setOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setOver(false);
                addFiles(e.dataTransfer.files);
              }}
            >
              <UploadCloud aria-hidden />
              <strong>Arraste os arquivos ou clique para escolher</strong>
              <span>.zip, .exe, .dmg, .apk, .tar.gz · os arquivos ficam no seu computador nesta demonstração</span>
            </div>
            <input ref={fileRef} type="file" multiple hidden onChange={(e) => addFiles(e.target.files)} />
            {tried && !files.length && <p className="publish-error">Adicione pelo menos um arquivo.</p>}
            {files.length > 0 && (
              <ul className="uploads">
                {files.map((f, i) => (
                  <li key={`${f.name}-${i}`}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {f.name} <small style={{ color: "var(--ink-mute)" }}>{fmtSize(f.size)}</small>
                    </span>
                    <select
                      aria-label={`Plataforma de ${f.name}`}
                      value={f.platform}
                      onChange={(e) => setFiles((cur) => cur.map((x, j) => (j === i ? { ...x, platform: e.target.value as Platform } : x)))}
                    >
                      {(Object.keys(PLATFORMS) as Platform[]).map((p) => (
                        <option key={p} value={p}>{PLATFORMS[p].name}</option>
                      ))}
                    </select>
                    <button type="button" className="icon-btn" aria-label={`Remover ${f.name}`} onClick={() => setFiles((cur) => cur.filter((_, j) => j !== i))}>
                      <Trash2 aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </li>

        <li className="step" data-done={done[4]}>
          <span className="step-num" aria-hidden>4</span>
          <div>
            <h2>Preço</h2>
            <p>Você pode mudar isso a qualquer momento depois de publicar.</p>
            <div className="stack">
              <div className="seg" role="radiogroup" aria-label="Modelo de preço">
                {(
                  [
                    ["free", "Grátis"],
                    ["fixed", "Preço fixo"],
                    ["pwyw", "Pague o que quiser"],
                  ] as const
                ).map(([k, l]) => (
                  <button key={k} type="button" role="radio" aria-checked={priceKind === k} onClick={() => setPriceKind(k)}>{l}</button>
                ))}
              </div>
              {priceKind !== "free" && (
                <div>
                  <label className="field-label" htmlFor={`${id}-p`}>{priceKind === "fixed" ? "Preço" : "Mínimo (0 deixa livre)"}</label>
                  <div className="money">
                    <span aria-hidden>R$</span>
                    <input id={`${id}-p`} className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d,.]/g, ""))} />
                  </div>
                  {priceKind === "fixed" && n === 0 && <p className="publish-error">Preço fixo precisa ser maior que zero. Para zero, escolha Grátis.</p>}
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
            <textarea id={`${id}-d`} className="textarea" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Você é um barco de papel na primeira chuva de março..." />
            {tried && description.trim().length <= 20 && <p className="publish-error">Escreva pelo menos uma frase completa sobre o jogo.</p>}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center", marginTop: 32 }}>
              <button type="submit" className="btn btn--lime" style={{ borderColor: "var(--ink)" }}>
                Publicar no programa
              </button>
              <span className="field-hint" style={{ marginTop: 0 }}>
                {ready ? "Tudo pronto." : `${Object.values(done).filter((d) => !d).length} passo(s) ainda em aberto.`}
              </span>
            </div>
            {published && (
              <p className="publish-done" role="status">
                Pronto. Numa versão conectada, “{draft.title}” entraria agora no topo de Hoje no programa. Nesta demonstração nada foi enviado.
              </p>
            )}
          </div>
        </li>
      </ol>

      <aside className="preview-col" aria-label="Prévia da entrada">
        <div className="label">
          <span>Sua entrada no programa</span>
          <span>{t.name}</span>
        </div>
        <div className={`preview-sheet${t.on === "--paper" ? " on-field" : ""}`} style={trackStyle(track)}>
          <Entry game={draft} variant="lead" link={false} />
        </div>
      </aside>
    </form>
  );
}
