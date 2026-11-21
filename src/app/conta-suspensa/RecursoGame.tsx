"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Gavel, MessageSquareQuote, Volume2, VolumeX, X } from "lucide-react";
import { CASES, JUDGES, MAX_CARRY, NEEDED, accepted, reaction, score, verdictLine, votes, type Answer, type Case, type Evidence, type Tone } from "./casos";
import { judgeTurn, judgeVerdict, type TurnResult, type VerdictResult } from "./actions";
import type { TribunalView } from "./tribunal3d";

/*
 * "O Recurso": um julgamento em primeira pessoa num tribunal 3D realista.
 * Você examina as provas na mesa da defesa, leva até três para a tribuna e
 * responde às perguntas de cinco juízes-máquina; o visor de cada um muda de
 * cor conforme o voto. São precisos 4 de 5 para reverter, como no plenário
 * de verdade. A cena (tribunal3d.ts, Three.js) só é baixada quando a página
 * abre; os casos e a pontuação ficam em casos.ts.
 */

type Phase = "title" | "brief" | "walk" | "prep" | "hearing" | "thinking" | "reacting" | "deliberation" | "verdict";

/** Quanto esperar pela IA antes de seguir com a pontuação fixa. */
const AI_TIMEOUT_MS = 9000;
const MAX_ANSWER = 600;

const KIND: Record<Evidence["kind"], string> = {
  print: "Print de tela",
  email: "E-mail impresso",
  documento: "Documento",
  notebook: "Notebook",
  celular: "Celular",
  nota: "Comprovante",
};
/** Ordem em que as lâmpadas de voto acendem: da esquerda para a direita na bancada. */
const SEAT_ORDER = [0, 1, 4, 2, 3];
const VOICE_KEY = "recurso:vozes";
const MUTE_KEY = "recurso:mudo";

function readStore(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeStore(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {}
}
const shuffle = <T,>(xs: T[]) => {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------------------------------------------ */
/* Som ambiente: passos, papel, martelo (sintetizados, sem arquivos)    */
/* ------------------------------------------------------------------ */

class Foley {
  private ctx: AudioContext | null = null;
  muted = false;
  private noise: AudioBuffer | null = null;

  private audio() {
    if (this.muted) return null;
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
        const len = this.ctx.sampleRate;
        this.noise = this.ctx.createBuffer(1, len, len);
        const d = this.noise.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      } catch {
        return null;
      }
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  private burst(dur: number, filter: BiquadFilterType, freq: number, vol: number, delay = 0) {
    const a = this.audio();
    if (!a || !this.noise) return;
    const t = a.currentTime + delay;
    const src = a.createBufferSource();
    src.buffer = this.noise;
    const f = a.createBiquadFilter();
    f.type = filter;
    f.frequency.value = freq;
    const g = a.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(a.destination);
    src.start(t, Math.random() * 0.5, dur + 0.05);
  }

  private tone(freq: number, dur: number, vol: number, delay = 0, type: OscillatorType = "sine") {
    const a = this.audio();
    if (!a) return;
    const t = a.currentTime + delay;
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(freq * 0.6, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(a.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  step() {
    this.burst(0.07, "lowpass", 520 + Math.random() * 200, 0.22);
    this.tone(70 + Math.random() * 20, 0.06, 0.08);
  }
  paper() {
    this.burst(0.18, "highpass", 2600, 0.08);
  }
  vote(yes: boolean) {
    this.tone(yes ? 660 : 330, 0.35, 0.06, 0, "triangle");
  }
  gavel() {
    for (const d of [0, 0.32]) {
      this.tone(120, 0.25, 0.35, d, "triangle");
      this.burst(0.05, "bandpass", 1800, 0.25, d);
    }
  }
}

export function RecursoGame({ realAppeal }: { realAppeal: boolean }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const view = useRef<TribunalView | null>(null);
  const foley = useRef(new Foley());
  const lastCase = useRef(-1);

  const [phase, setPhase] = useState<Phase>("title");
  const [ready, setReady] = useState(false);
  const [broken, setBroken] = useState(false);
  const [caseIdx, setCaseIdx] = useState(0);
  const [picked, setPicked] = useState<string[]>([]);
  const [examining, setExamining] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  const [attached, setAttached] = useState<string | null>(null);
  const [lean, setLean] = useState<number[]>(() => JUDGES.map((j) => j.start));
  const [log, setLog] = useState<{ tone: Tone; ev: Evidence | null }[]>([]);
  const [said, setSaid] = useState("");
  const [shownVotes, setShownVotes] = useState<(boolean | null)[]>(() => JUDGES.map(() => null));
  const [voices, setVoices] = useState(true);
  const [muted, setMuted] = useState(false);
  const [live, setLive] = useState("");
  // IA em tempo real: a pergunta como foi dita (com a réplica), o que já se falou e as linhas do veredito.
  const [asked, setAsked] = useState("");
  const [draft, setDraft] = useState("");
  const [transcript, setTranscript] = useState<{ judge: number; question: string; answer: string }[]>([]);
  const [aiLines, setAiLines] = useState<string[] | null>(null);
  const [offline, setOffline] = useState(false);
  const verdictAi = useRef<Promise<VerdictResult> | null>(null);

  const c: Case = CASES[caseIdx];
  const question = c.questions[round];
  const answers = useMemo(() => shuffle(question?.answers ?? []), [question]);
  const ev = (id: string | null) => c.evidence.find((e) => e.id === id) ?? null;

  // Preferências.
  useEffect(() => {
    const v = readStore(VOICE_KEY);
    if (v !== null) setVoices(v === "1");
    const m = readStore(MUTE_KEY) === "1";
    setMuted(m);
    foley.current.muted = m;
  }, []);

  const speak = useCallback(
    (text: string, judge: number) => {
      if (!voices || muted || typeof window === "undefined" || !("speechSynthesis" in window)) return;
      const synth = window.speechSynthesis;
      synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "pt-BR";
      const pt = synth.getVoices().filter((v) => v.lang.toLowerCase().startsWith("pt"));
      if (pt.length) u.voice = pt[judge % pt.length];
      u.pitch = [0.95, 0.75, 1.1, 0.85, 1][judge];
      u.rate = 1.02;
      synth.speak(u);
    },
    [voices, muted],
  );
  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  // A cena 3D: baixada e montada só agora.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let alive = true;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    void import("./tribunal3d")
      .then(({ createTribunal }) => {
        if (!alive) return;
        try {
          view.current = createTribunal(canvas, {
            names: JUDGES.map((j) => j.name),
            reduced,
            onPick: (id) => {
              foley.current.paper();
              setExamining(id);
            },
            onHover: () => {},
            onStep: () => foley.current.step(),
          });
          setReady(true);
        } catch (err) {
          console.error("[recurso] 3D", err);
          setBroken(true);
        }
      })
      .catch((err) => {
        console.error("[recurso] 3D", err);
        if (alive) setBroken(true);
      });
    const ro = new ResizeObserver(() => view.current?.resize());
    ro.observe(canvas);
    return () => {
      alive = false;
      ro.disconnect();
      view.current?.dispose();
      view.current = null;
    };
  }, []);

  // Mantém a cena em dia com o estado.
  useEffect(() => {
    view.current?.setPicked(picked);
  }, [picked, ready]);
  useEffect(() => {
    view.current?.setLean(lean);
  }, [lean, ready]);
  useEffect(() => {
    view.current?.setVotes(shownVotes);
  }, [shownVotes, ready]);

  const begin = () => {
    let i = Math.floor(Math.random() * CASES.length);
    if (CASES.length > 1 && i === lastCase.current) i = (i + 1) % CASES.length;
    lastCase.current = i;
    setCaseIdx(i);
    setPicked([]);
    setExamining(null);
    setRound(0);
    setAttached(null);
    setLean(JUDGES.map((j) => j.start));
    setLog([]);
    setSaid("");
    setDraft("");
    setTranscript([]);
    setAiLines(null);
    setOffline(false);
    setShownVotes(JUDGES.map(() => null));
    view.current?.setEvidence(CASES[i].evidence);
    view.current?.focusJudge(null);
    view.current?.setSpeaking(null);
    void view.current?.goTo("intro", false);
    setPhase("brief");
    setLive(`Caso: ${CASES[i].game}. Leia a ficha.`);
  };

  const toTable = async () => {
    setPhase("walk");
    await view.current?.goTo("mesa");
    setPhase("prep");
    setLive("Mesa da defesa. Examine as provas e escolha até três.");
    stageRef.current?.focus();
  };

  const toggleCarry = (id: string) => {
    foley.current.paper();
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= MAX_CARRY ? p : [...p, id]));
  };

  const ask = useCallback(
    (r: number, bridge: string | null = null) => {
      const q = c.questions[r];
      const text = bridge ? `${bridge} ${q.text}` : q.text;
      view.current?.focusJudge(q.judge);
      view.current?.setSpeaking(q.judge);
      setRound(r);
      setAttached(null);
      setSaid("");
      setDraft("");
      setAsked(text);
      setPhase("hearing");
      setLive(`${JUDGES[q.judge].name} pergunta: ${text}`);
      speak(text, q.judge);
    },
    [c, speak],
  );

  const toLectern = async () => {
    setExamining(null);
    setPhase("walk");
    await view.current?.goTo("tribuna");
    await wait(400);
    ask(0);
  };

  const deliberate = useCallback(
    async (final: number[]) => {
      setPhase("deliberation");
      view.current?.setSpeaking(null);
      view.current?.focusJudge(null);
      setLive("O plenário vota.");
      await wait(1400);
      const v = votes(final);
      const shown: (boolean | null)[] = JUDGES.map(() => null);
      for (const i of SEAT_ORDER) {
        shown[i] = v[i];
        setShownVotes([...shown]);
        foley.current.vote(v[i]);
        setLive(`${JUDGES[i].name}: ${v[i] ? "reverter" : "manter"}.`);
        await wait(1100);
      }
      foley.current.gavel();
      await wait(700);
      // As linhas da IA foram pedidas no começo da votação; se não chegaram, ficam as fixas.
      const ai = await Promise.race([verdictAi.current ?? Promise.resolve<VerdictResult>({ ok: false }), wait(4000).then((): VerdictResult => ({ ok: false }))]);
      if (ai.ok) setAiLines(ai.lines);
      setPhase("verdict");
      setLive(accepted(final) ? "Recurso aceito." : "Recurso negado.");
    },
    [],
  );

  /**
   * Responde: uma sugestão (`preset`, pontuação fixa e testada) ou um texto livre (a IA mede o efeito).
   * A IA também faz a reação no personagem e a réplica da próxima pergunta; se falhar ou
   * demorar, o jogo segue com a pontuação e as falas fixas de casos.ts.
   */
  const answer = async (text: string, preset: Answer | null) => {
    if (phase !== "hearing" || !text.trim()) return;
    const proof = ev(attached);
    const spoken = text.trim().slice(0, MAX_ANSWER);
    if (proof) foley.current.paper();
    setPhase("thinking");
    view.current?.setSpeaking(null);
    setLive(`${JUDGES[question.judge].name} está pensando.`);
    const turn = { caseId: c.id, round, answer: spoken, evidenceId: proof?.id ?? null, transcript, free: !preset };
    const ai = await Promise.race([
      judgeTurn(turn).catch((): TurnResult => ({ ok: false })),
      wait(AI_TIMEOUT_MS).then((): TurnResult => ({ ok: false })),
    ]);
    if (!ai.ok) setOffline(true);
    const asPreset: Answer = preset ?? { text: spoken, tone: "fato" };
    const delta = !preset && ai.ok && ai.deltas ? ai.deltas : score(question, asPreset, proof);
    const next = lean.map((v, i) => v + delta[i]);
    setLean(next);
    setLog((l) => [...l, { tone: asPreset.tone, ev: proof }]);
    const nextTranscript = [...transcript, { judge: question.judge, question: asked, answer: spoken }];
    setTranscript(nextTranscript);
    const line = ai.ok ? ai.reaction : reaction(delta[question.judge], asPreset, proof);
    setSaid(line);
    setPhase("reacting");
    view.current?.setSpeaking(question.judge);
    speak(line, question.judge);
    setLive(`${JUDGES[question.judge].name}: ${line}`);
    await wait(Math.min(6000, 1800 + line.length * 45));
    if (round + 1 < c.questions.length) ask(round + 1, ai.ok ? ai.bridge : null);
    else {
      verdictAi.current = judgeVerdict({ caseId: c.id, transcript: nextTranscript, votes: votes(next) }).catch((): VerdictResult => ({ ok: false }));
      void deliberate(next);
    }
  };

  const toggleVoices = () => {
    const v = !voices;
    setVoices(v);
    writeStore(VOICE_KEY, v ? "1" : "0");
    if (!v) window.speechSynthesis?.cancel();
  };
  const toggleMute = () => {
    const m = !muted;
    setMuted(m);
    foley.current.muted = m;
    writeStore(MUTE_KEY, m ? "1" : "0");
    if (m) window.speechSynthesis?.cancel();
  };

  // Setas giram o olhar (o arrasto faz o mesmo com mouse ou dedo).
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.target !== stageRef.current) return;
    const step = 0.12;
    const map: Record<string, [number, number]> = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    const m = map[e.key];
    if (!m) return;
    e.preventDefault();
    view.current?.nudge(m[0], m[1]);
  };

  const exam = ev(examining);
  const judge = question ? JUDGES[question.judge] : null;
  const final = votes(lean);
  const won = accepted(lean);

  return (
    <section className="rc" aria-labelledby="rc-title">
      <div className="rc-bar">
        <h2 id="rc-title" className="rc-title">
          O Recurso
        </h2>
        <div className="rc-tools">
          <button type="button" className="btn btn--sm btn--ghost rc-tool" onClick={toggleVoices} aria-pressed={voices}>
            <MessageSquareQuote aria-hidden />
            {voices ? "Vozes ligadas" : "Vozes desligadas"}
          </button>
          <button type="button" className="btn btn--sm btn--ghost rc-tool" onClick={toggleMute} aria-pressed={muted}>
            {muted ? <VolumeX aria-hidden /> : <Volume2 aria-hidden />}
            {muted ? "Som desligado" : "Som ligado"}
          </button>
        </div>
      </div>

      <div
        ref={stageRef}
        className="rc-stage"
        data-phase={phase}
        tabIndex={0}
        role="group"
        aria-roledescription="jogo"
        aria-label="Tribunal em 3D. Arraste ou use as setas para olhar em volta."
        onKeyDown={onKeyDown}
      >
        <canvas ref={canvasRef} className="rc-canvas" aria-hidden />

        {broken ? (
          <div className="rc-screen">
            <h3>O tribunal não abriu</h3>
            <p>Este navegador não conseguiu desenhar a cena em 3D. O resto da página funciona normalmente.</p>
          </div>
        ) : null}

        {!broken && phase === "title" ? (
          <div className="rc-screen rc-screen--title">
            <p className="rc-kicker">Enquanto o seu caso espera</p>
            <h3>Defenda um recurso no plenário</h3>
            <p>
              Você entra num tribunal, examina as provas do caso, escolhe o que levar e responde a cinco juízes-máquina.
              Cada um pesa uma coisa. O visor deles muda de cor conforme o voto: são precisos {NEEDED} de 5 para
              reverter.
            </p>
            <button type="button" className="btn rc-go" onClick={begin} disabled={!ready}>
              <Gavel aria-hidden /> {ready ? "Entrar no tribunal" : "Montando o tribunal…"}
            </button>
            <p className="rc-keys">
              Arraste (ou use as setas) para olhar em volta. Os juízes respondem em tempo real com IA: o que você
              escrever vai para um modelo de linguagem, então não coloque dados pessoais.
            </p>
          </div>
        ) : null}

        {phase === "brief" ? (
          <div className="rc-screen rc-screen--brief">
            <div className="rc-file">
              <p className="rc-kicker">Ficha do caso · regra “{c.rule}”</p>
              <h3>{c.game}</h3>
              <dl className="rc-facts">
                <div>
                  <dt>Acusação</dt>
                  <dd>{c.accusation}</dd>
                </div>
                <div>
                  <dt>O seu lado</dt>
                  <dd>{c.yourSide}</dd>
                </div>
              </dl>
              <p className="rc-kicker">O plenário</p>
              <ul className="rc-bench">
                {JUDGES.map((j) => (
                  <li key={j.name}>
                    <strong>{j.name}</strong>, {j.title.toLowerCase()}. {j.trait}
                  </li>
                ))}
              </ul>
              <button type="button" className="btn rc-go" onClick={() => void toTable()}>
                Ir para a mesa da defesa
              </button>
            </div>
          </div>
        ) : null}

        {phase === "prep" ? (
          <aside className="rc-side" aria-label="Provas na mesa">
            <p className="rc-kicker">Mesa da defesa</p>
            <p className="rc-side-help">
              Examine as provas e leve até {MAX_CARRY} para a tribuna. Nem tudo ajuda.
            </p>
            <ul className="rc-evidence">
              {c.evidence.map((e) => (
                <li key={e.id}>
                  <button type="button" className="rc-ev" onClick={() => setExamining(e.id)} data-picked={picked.includes(e.id) || undefined}>
                    <span className="rc-ev-kind">{KIND[e.kind]}</span>
                    <span className="rc-ev-title">{e.title}</span>
                    {picked.includes(e.id) ? <span className="rc-ev-badge">Na pasta</span> : null}
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" className="btn rc-go" onClick={() => void toLectern()}>
              Ir para a tribuna ({picked.length}/{MAX_CARRY})
            </button>
          </aside>
        ) : null}

        {exam && phase === "prep" ? (
          <div className="rc-modal" role="dialog" aria-modal="false" aria-labelledby="rc-exam-t">
            <button type="button" className="rc-close" onClick={() => setExamining(null)} aria-label="Fechar">
              <X aria-hidden />
            </button>
            <p className="rc-kicker">{KIND[exam.kind]}</p>
            <h3 id="rc-exam-t">{exam.title}</h3>
            <p className="rc-doc">{exam.text}</p>
            <div className="rc-row">
              <button
                type="button"
                className="btn rc-go"
                onClick={() => toggleCarry(exam.id)}
                disabled={!picked.includes(exam.id) && picked.length >= MAX_CARRY}
              >
                {picked.includes(exam.id) ? "Tirar da pasta" : "Levar para a tribuna"}
              </button>
              {!picked.includes(exam.id) && picked.length >= MAX_CARRY ? <span className="rc-note">A pasta está cheia.</span> : null}
            </div>
          </div>
        ) : null}

        {(phase === "hearing" || phase === "thinking" || phase === "reacting") && judge && question ? (
          <div className="rc-dock">
            <p className="rc-speaker">
              {judge.name} <span>· {judge.title}</span>
            </p>
            {phase === "thinking" ? (
              <p className="rc-line rc-thinking">
                {judge.name.split(" ")[0]} {judge.name.split(" ")[1]} está pensando<span aria-hidden>…</span>
              </p>
            ) : (
              <p className="rc-line">{phase === "reacting" ? `“${said}”` : `“${asked}”`}</p>
            )}
            {phase === "hearing" ? (
              <>
                <form
                  className="rc-say"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void answer(draft, null);
                  }}
                >
                  <label className="visually-hidden" htmlFor="rc-say-input">
                    Sua resposta
                  </label>
                  <textarea
                    id="rc-say-input"
                    className="rc-say-input"
                    value={draft}
                    maxLength={MAX_ANSWER}
                    rows={2}
                    placeholder="Responda com suas palavras…"
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void answer(draft, null);
                      }
                    }}
                  />
                  <button type="submit" className="btn rc-go" disabled={draft.trim().length < 2}>
                    Responder
                  </button>
                </form>
                {picked.length ? (
                  <div className="rc-attach" role="group" aria-label="Anexar uma prova à resposta">
                    <span>Anexar prova:</span>
                    {picked.map((id) => (
                      <button key={id} type="button" className="rc-chip" aria-pressed={attached === id} onClick={() => setAttached((a) => (a === id ? null : id))}>
                        {ev(id)?.title}
                      </button>
                    ))}
                  </div>
                ) : null}
                <p className="rc-round">Ou escolha uma resposta pronta:</p>
                <ul className="rc-answers">
                  {answers.map((a) => (
                    <li key={a.text}>
                      <button type="button" className="rc-answer" onClick={() => void answer(a.text, a)}>
                        {a.text}
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="rc-round">
                  Pergunta {round + 1} de {c.questions.length}
                  {offline ? " · juízes sem IA agora: valem as respostas prontas e a pontuação fixa" : ""}
                </p>
              </>
            ) : null}
          </div>
        ) : null}

        {phase === "deliberation" ? (
          <div className="rc-dock rc-dock--quiet">
            <p className="rc-line">O plenário vota.</p>
            <ol className="rc-votes">
              {SEAT_ORDER.map((i) => (
                <li key={i} data-vote={shownVotes[i] === null ? undefined : shownVotes[i] ? "sim" : "nao"}>
                  {JUDGES[i].name}: {shownVotes[i] === null ? "…" : shownVotes[i] ? "reverter" : "manter"}
                </li>
              ))}
            </ol>
          </div>
        ) : null}

        {phase === "verdict" ? (
          <div className="rc-screen rc-screen--verdict" data-won={won || undefined}>
            <div className="rc-file">
              <p className="rc-kicker">
                {final.filter(Boolean).length} de 5 votos para reverter · eram precisos {NEEDED}
              </p>
              <h3>{won ? "Recurso aceito" : "Recurso negado"}</h3>
              <ul className="rc-bench">
                {JUDGES.map((j, i) => (
                  <li key={j.name} data-vote={final[i] ? "sim" : "nao"}>
                    <strong>{j.name}</strong> ({final[i] ? "reverter" : "manter"}): {aiLines?.[i] ?? verdictLine(i, lean[i], log)}
                  </li>
                ))}
              </ul>
              <p className="rc-kicker">No recurso de verdade</p>
              <ul className="rc-tips">
                <li>Diga o que os juízes entenderam errado, com datas, números e nomes de arquivo.</li>
                <li>Mostre prova que dá para conferir: um código na página, um contrato com número, um histórico público.</li>
                <li>Deixe a raiva de fora. O tribunal reescreve o texto em tom neutro, e o que sobra são os fatos.</li>
              </ul>
              {realAppeal ? <p>O formulário de recurso de verdade fica logo abaixo desta área.</p> : null}
              <button type="button" className="btn rc-go" onClick={begin}>
                <Gavel aria-hidden /> Outro caso
              </button>
            </div>
          </div>
        ) : null}
      </div>
      <p className="visually-hidden" role="status" aria-live="polite">
        {live}
      </p>
    </section>
  );
}
