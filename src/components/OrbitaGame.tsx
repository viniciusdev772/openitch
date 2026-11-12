"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Phase = "idle" | "playing" | "over";

interface Thing {
  angle: number;
  lane: 0 | 1;
  kind: "star" | "rock";
  alive: boolean;
}

const TAU = Math.PI * 2;

function cssVar(el: Element, name: string, fallback: string) {
  const v = getComputedStyle(el).getPropertyValue(name).trim();
  return v || fallback;
}

/**
 * Órbita: the sample browser game on the cover. One input switches the moon
 * between two orbits; collect stars, dodge rocks. Each lap speeds the spin.
 */
export function OrbitaGame({ label = "Órbita, jogo de navegador" }: { label?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);

  const state = useRef({
    angle: -Math.PI / 2,
    lane: 1 as 0 | 1,
    laneT: 1,
    speed: 1.1,
    laps: 0,
    lastLapAngle: 0,
    things: [] as Thing[],
    score: 0,
    phase: "idle" as Phase,
    flash: 0,
    visible: true,
  });

  const seed = useCallback(() => {
    const things: Thing[] = [];
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * TAU + 0.4;
      things.push({
        angle,
        lane: (i % 3 === 0 ? 0 : 1) as 0 | 1,
        kind: i % 4 === 2 ? "rock" : "star",
        alive: true,
      });
    }
    return things;
  }, []);

  const start = useCallback(() => {
    const s = state.current;
    s.angle = -Math.PI / 2;
    s.lane = 1;
    s.laneT = 1;
    s.speed = 1.1;
    s.laps = 0;
    s.lastLapAngle = 0;
    s.things = seed();
    s.score = 0;
    s.phase = "playing";
    setScore(0);
    setPhase("playing");
  }, [seed]);

  const press = useCallback(() => {
    const s = state.current;
    if (s.phase !== "playing") {
      start();
      return;
    }
    s.lane = s.lane === 1 ? 0 : 1;
  }, [start]);

  useEffect(() => {
    try {
      const b = Number(localStorage.getItem("orbita-best") || 0);
      if (b) setBest(b);
    } catch {
      /* storage unavailable */
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const s = state.current;
    if (!s.things.length) s.things = seed();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let raf = 0;
    let last = performance.now();
    let w = 0;
    let h = 0;
    const colors = {
      ground: cssVar(canvas, "--ultra-deep", "#1b1ea3"),
      planet: cssVar(canvas, "--lime", "#c8f03c"),
      moon: cssVar(canvas, "--paper", "#eceee8"),
      rock: cssVar(canvas, "--magenta", "#ff4d94"),
      ink: cssVar(canvas, "--ink", "#12131b"),
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = rect.width;
      h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw(0);
    };

    const star = (x: number, y: number, r: number) => {
      const k = r * 0.3;
      ctx.beginPath();
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + k, y - k);
      ctx.lineTo(x + r, y);
      ctx.lineTo(x + k, y + k);
      ctx.lineTo(x, y + r);
      ctx.lineTo(x - k, y + k);
      ctx.lineTo(x - r, y);
      ctx.lineTo(x - k, y - k);
      ctx.closePath();
      ctx.fill();
    };

    const draw = (dt: number) => {
      const cx = w / 2;
      const cy = h / 2 - h * 0.04;
      const base = Math.min(w, h);
      const r0 = base * 0.2;
      const r1 = base * 0.34;
      const t = performance.now() / 1000;

      if (s.phase === "playing" && dt > 0) {
        const prev = s.angle;
        s.angle += s.speed * dt;
        if (Math.floor((s.angle + Math.PI / 2) / TAU) > Math.floor((prev + Math.PI / 2) / TAU)) {
          s.laps += 1;
          s.speed = Math.min(1.1 + s.laps * 0.22, 3.4);
          for (const th of s.things) {
            if (!th.alive) {
              th.alive = true;
              th.lane = Math.random() < 0.5 ? 0 : 1;
              th.kind = Math.random() < 0.28 + Math.min(s.laps * 0.04, 0.2) ? "rock" : "star";
            }
          }
        }
        const target = s.lane;
        s.laneT += (target - s.laneT) * Math.min(1, dt * 14);

        const moonR = r0 + (r1 - r0) * s.laneT;
        const mx = cx + Math.cos(s.angle) * moonR;
        const my = cy + Math.sin(s.angle) * moonR;
        for (const th of s.things) {
          if (!th.alive) continue;
          const rr = th.lane === 0 ? r0 : r1;
          const tx = cx + Math.cos(th.angle) * rr;
          const ty = cy + Math.sin(th.angle) * rr;
          const d = Math.hypot(tx - mx, ty - my);
          if (d < base * 0.045) {
            th.alive = false;
            if (th.kind === "star") {
              s.score += 1;
              s.flash = 1;
              setScore(s.score);
            } else {
              s.phase = "over";
              setPhase("over");
              setBest((b) => {
                const nb = Math.max(b, s.score);
                try {
                  localStorage.setItem("orbita-best", String(nb));
                } catch {
                  /* storage unavailable */
                }
                return nb;
              });
            }
          }
        }
      }
      s.flash = Math.max(0, s.flash - dt * 3);

      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = colors.ground;
      ctx.fillRect(0, 0, w, h);

      // orbit lanes
      ctx.lineWidth = 2;
      ctx.strokeStyle = colors.moon;
      for (const [rr, a] of [
        [r0, s.lane === 0 ? 0.55 : 0.22],
        [r1, s.lane === 1 ? 0.55 : 0.22],
      ] as const) {
        ctx.globalAlpha = a;
        ctx.beginPath();
        ctx.arc(cx, cy, rr, 0, TAU);
        ctx.stroke();
      }
      ctx.globalAlpha = 0.14;
      ctx.setLineDash([3, 9]);
      ctx.beginPath();
      ctx.arc(cx, cy, r1 + base * 0.1, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;

      // planet
      const pulse = s.flash * base * 0.015;
      ctx.fillStyle = colors.planet;
      ctx.beginPath();
      ctx.arc(cx, cy, base * 0.11 + pulse, 0, TAU);
      ctx.fill();
      ctx.fillStyle = colors.ground;
      ctx.globalAlpha = 0.28;
      ctx.beginPath();
      ctx.arc(cx - base * 0.03, cy - base * 0.03, base * 0.025, 0, TAU);
      ctx.arc(cx + base * 0.035, cy + base * 0.02, base * 0.015, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;

      // things
      for (const th of s.things) {
        if (!th.alive) continue;
        const rr = th.lane === 0 ? r0 : r1;
        const tx = cx + Math.cos(th.angle) * rr;
        const ty = cy + Math.sin(th.angle) * rr;
        if (th.kind === "star") {
          ctx.fillStyle = colors.planet;
          const tw = reduce ? 1 : 1 + Math.sin(t * 4 + th.angle * 3) * 0.12;
          star(tx, ty, base * 0.028 * tw);
        } else {
          ctx.fillStyle = colors.rock;
          ctx.save();
          ctx.translate(tx, ty);
          ctx.rotate(reduce ? 0 : t * 1.5 + th.angle);
          const q = base * 0.024;
          ctx.fillRect(-q, -q, q * 2, q * 2);
          ctx.restore();
        }
      }

      // moon
      const moonR = r0 + (r1 - r0) * s.laneT;
      const mx = cx + Math.cos(s.angle) * moonR;
      const my = cy + Math.sin(s.angle) * moonR;
      ctx.fillStyle = colors.moon;
      ctx.beginPath();
      ctx.arc(mx, my, base * 0.032, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = colors.ink;
      ctx.lineWidth = 2;
      ctx.stroke();
    };

    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      if (s.visible) draw(dt);
      raf = requestAnimationFrame(loop);
    };

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => {
      s.visible = e.isIntersecting;
    });
    io.observe(canvas);
    resize();
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
    };
  }, [seed]);

  return (
    <>
      <canvas
        ref={canvasRef}
        className="orbita"
        tabIndex={0}
        role="img"
        aria-label={`${label}. Pressione espaço ou toque para trocar de órbita.`}
        onPointerDown={(e) => {
          e.preventDefault();
          press();
        }}
        onKeyDown={(e) => {
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            press();
          }
        }}
      />
      <div className="orbita-hud" aria-live="polite">
        <span className="score">{score}</span>
        <span className="best">recorde {best}</span>
      </div>
      {phase !== "playing" && (
        <div className="orbita-overlay">
          <p>
            {phase === "idle"
              ? "Toque ou aperte espaço para jogar"
              : `Fim da volta: ${score} ${score === 1 ? "estrela" : "estrelas"}. Toque para de novo`}
          </p>
        </div>
      )}
    </>
  );
}
