import type { Game } from "@/data/catalog";

/**
 * Authored cover styles: small posters drawn in the programme's spot inks,
 * with the title set in the display face. Drafts pick one until real cover
 * uploads exist.
 */

const W = 400;
const H = 320;

const v = (name: string) => `var(${name})`;

function splitTitle(title: string, max = 11): string[] {
  const words = title.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if (!cur) cur = w;
    else if ((cur + " " + w).length <= max) cur += " " + w;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function Title({
  text,
  x,
  y,
  fill,
  size = 52,
  anchor = "start",
  max,
  top = false,
}: {
  text: string;
  x: number;
  y: number;
  fill: string;
  size?: number;
  anchor?: "start" | "end" | "middle";
  max?: number;
  top?: boolean;
}) {
  const lines = splitTitle(text, max);
  const lh = size * 0.86;
  const first = top ? y : y - (lines.length - 1) * lh;
  return (
    <text
      x={x}
      y={first}
      fill={fill}
      textAnchor={anchor}
      style={{
        fontFamily: "var(--display)",
        fontStretch: "55%",
        fontWeight: 900,
        fontSize: size,
        letterSpacing: "-0.02em",
      }}
    >
      {lines.map((l, i) => (
        <tspan key={i} x={x} dy={i === 0 ? 0 : lh}>
          {l}
        </tspan>
      ))}
    </text>
  );
}

function Star({ x, y, r, fill }: { x: number; y: number; r: number; fill: string }) {
  const k = r * 0.28;
  return (
    <path
      d={`M${x} ${y - r} L${x + k} ${y - k} L${x + r} ${y} L${x + k} ${y + k} L${x} ${y + r} L${x - k} ${y + k} L${x - r} ${y} L${x - k} ${y - k} Z`}
      fill={fill}
    />
  );
}

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function Art({ game }: { game: Game }) {
  const [g, f, a] = game.palette.map(v);
  const r = rng(game.number * 97 + 13);

  switch (game.cover) {
    case "orbit":
      return (
        <>
          <rect width={W} height={H} fill={g} />
          {[70, 110, 150, 190].map((rad, i) => (
            <circle key={rad} cx={250} cy={150} r={rad} fill="none" stroke={a} strokeOpacity={0.18 + i * 0.06} strokeWidth={i === 1 || i === 2 ? 3 : 1.5} strokeDasharray={i === 3 ? "4 8" : undefined} />
          ))}
          <circle cx={250} cy={150} r={44} fill={f} />
          <circle cx={238} cy={138} r={9} fill={g} opacity={0.35} />
          <circle cx={250 + 110 * Math.cos(-0.7)} cy={150 + 110 * Math.sin(-0.7)} r={13} fill={a} />
          {[[-2.4, 150], [0.5, 150], [1.7, 110], [2.6, 110], [-1.4, 110]].map(([ang, rad], i) => (
            <Star key={i} x={250 + rad * Math.cos(ang)} y={150 + rad * Math.sin(ang)} r={9} fill={f} />
          ))}
          <Title text={game.title} x={24} y={292} fill={a} size={64} />
        </>
      );
    case "beam":
      return (
        <>
          <rect width={W} height={H} fill={g} />
          <path d={`M300 108 L0 30 L0 190 Z`} fill={f} opacity={0.9} />
          <path d={`M300 108 L0 70 L0 150 Z`} fill={a} opacity={0.35} />
          <rect x={286} y={108} width={34} height={150} fill={a} />
          {[0, 1, 2].map((i) => (
            <rect key={i} x={286} y={130 + i * 44} width={34} height={20} fill={f} />
          ))}
          <rect x={280} y={92} width={46} height={18} fill={a} />
          <path d="M284 92 L303 70 L322 92 Z" fill={f} />
          <rect x={0} y={258} width={W} height={62} fill={f} opacity={0.18} />
          {[268, 284, 300].map((y, i) => (
            <path key={y} d={`M${10 + i * 20} ${y} h${120 - i * 30} M${200 + i * 15} ${y} h${90 - i * 20}`} stroke={a} strokeOpacity={0.5} strokeWidth={2} />
          ))}
          <Title text={game.title} x={24} y={236} fill={a} size={60} />
        </>
      );
    case "letters": {
      const letters = "SOPALETRASINFINITAMAPEDRAVENTOCASAFOGOLUZ";
      const cells: React.ReactNode[] = [];
      const hl = new Set([12, 13, 14, 15, 24, 34, 44]);
      let k = 0;
      for (let row = 0; row < 6; row++) {
        for (let col = 0; col < 10; col++) {
          const idx = row * 10 + col;
          const ch = letters[(idx * 7) % letters.length];
          const on = hl.has(idx);
          cells.push(
            <g key={k++}>
              {on && <rect x={20 + col * 36} y={14 + row * 36} width={34} height={34} rx={8} fill={a} />}
              <text
                x={37 + col * 36}
                y={39 + row * 36}
                textAnchor="middle"
                fill={on ? f : a}
                fillOpacity={on ? 1 : 0.5}
                style={{ fontFamily: "var(--display)", fontStretch: "80%", fontWeight: 800, fontSize: 22 }}
              >
                {ch}
              </text>
            </g>,
          );
        }
      }
      return (
        <>
          <rect width={W} height={H} fill={g} />
          {cells}
          <rect x={0} y={228} width={W} height={92} fill={f} />
          <Title text={game.title} x={20} y={300} fill={a} size={40} max={14} />
        </>
      );
    }
    case "depths":
      return (
        <>
          <rect width={W} height={H} fill={g} />
          <rect y={60} width={W} height={H} fill={f} opacity={0.35} />
          <rect y={140} width={W} height={H} fill={f} opacity={0.6} />
          <rect y={220} width={W} height={H} fill={f} />
          <path d="M0 60 Q 25 52 50 60 T 100 60 T 150 60 T 200 60 T 250 60 T 300 60 T 350 60 T 400 60" stroke={a} strokeWidth={2.5} fill="none" />
          {[
            [40, 190, 40, 130],
            [90, 160, 30, 160],
            [126, 210, 56, 110],
            [190, 175, 26, 145],
            [222, 140, 44, 180],
            [272, 200, 34, 120],
            [312, 170, 52, 150],
          ].map(([x, y, w, h], i) => (
            <g key={i}>
              <rect x={x} y={y} width={w} height={h} fill={v("--ink")} opacity={0.55} />
              {Array.from({ length: Math.floor(h / 26) }).map((_, j) => (
                <rect key={j} x={x + 7} y={y + 10 + j * 26} width={w - 14 > 8 ? 8 : 4} height={10} fill={a} opacity={0.35} />
              ))}
            </g>
          ))}
          {[[340, 110, 6], [352, 86, 4], [334, 70, 3], [60, 120, 5], [70, 98, 3]].map(([x, y, rr], i) => (
            <circle key={i} cx={x} cy={y} r={rr} fill="none" stroke={a} strokeWidth={1.5} />
          ))}
          <Title text={game.title} x={24} y={44} fill={v("--ink")} size={40} max={20} top />
        </>
      );
    case "rain": {
      const drops = Array.from({ length: 46 }).map((_, i) => {
        const x = r() * 440 - 20;
        const y = r() * 240;
        return <path key={i} d={`M${x} ${y} l -10 22`} stroke={f} strokeWidth={4} strokeLinecap="round" />;
      });
      return (
        <>
          <rect width={W} height={H} fill={g} />
          {drops}
          <rect y={238} width={W} height={82} fill={v("--ink")} />
          {[30, 90, 140, 220, 280, 350].map((x, i) => (
            <rect key={x} x={x} y={244 + (i % 2) * 10} width={36 + (i % 3) * 20} height={10} rx={5} fill={i % 2 ? a : f} />
          ))}
          <Title text={game.title} x={376} y={300} fill={v("--paper")} size={44} anchor="end" max={20} />
        </>
      );
    }
    case "envelope":
      return (
        <>
          <rect width={W} height={H} fill={g} />
          <g transform="rotate(-6 200 150)">
            <rect x={70} y={60} width={260} height={170} rx={6} fill={a} stroke={f} strokeWidth={3} />
            <path d="M70 60 L200 160 L330 60" fill="none" stroke={f} strokeWidth={3} />
            <rect x={270} y={76} width={44} height={52} fill={f} />
            <rect x={276} y={82} width={32} height={40} fill="none" stroke={a} strokeWidth={1.5} strokeDasharray="3 3" />
            <path d="M96 200 h110 M96 214 h80" stroke={f} strokeWidth={3} />
          </g>
          <Title text={game.title} x={24} y={300} fill={f} size={46} max={20} />
        </>
      );
    case "pigeon":
      return (
        <>
          <rect width={W} height={H} fill={g} />
          {[0, 1, 2, 3, 4].map((i) => (
            <g key={i}>
              <rect x={i * 84 - 6} y={150 - (i % 2) * 40} width={70} height={200} fill={f} opacity={0.12} />
              {[0, 1, 2, 3].map((j) => (
                <rect key={j} x={i * 84 + 8} y={170 - (i % 2) * 40 + j * 34} width={14} height={18} fill={f} opacity={0.25} />
              ))}
            </g>
          ))}
          <ellipse cx={210} cy={140} rx={78} ry={46} fill={a} stroke={f} strokeWidth={3} />
          <circle cx={282} cy={104} r={30} fill={a} stroke={f} strokeWidth={3} />
          <path d="M308 100 L336 110 L308 116 Z" fill={f} />
          <circle cx={290} cy={98} r={5} fill={f} />
          <path d="M150 128 Q 200 60 250 120" fill={f} />
          <path d="M136 150 L96 170 L140 166 Z" fill={f} />
          <rect x={196} y={168} width={36} height={24} fill={g} stroke={f} strokeWidth={3} transform="rotate(8 214 180)" />
          <Title text={game.title} x={24} y={292} fill={f} size={42} max={14} />
        </>
      );
    case "fog":
      return (
        <>
          <rect width={W} height={H} fill={g} />
          <path d="M200 120 L40 320 L360 320 Z" fill={v("--paper")} opacity={0.08} />
          <path d="M200 120 L200 320" stroke={v("--paper")} strokeWidth={4} strokeDasharray="14 18" opacity={0.6} />
          <path d="M200 120 L40 320 M200 120 L360 320" stroke={v("--paper")} strokeWidth={2} opacity={0.5} />
          {[100, 140, 176, 214].map((y, i) => (
            <rect key={y} x={-20 + i * 30} y={y} width={W} height={18 + i * 4} rx={12} fill={v("--paper")} opacity={0.1 + i * 0.03} />
          ))}
          <circle cx={244} cy={150} r={4} fill={f} />
          <circle cx={258} cy={150} r={4} fill={f} />
          <Title text={game.title} x={24} y={62} fill={a} size={52} max={8} top />
        </>
      );
    case "garden":
      return (
        <>
          <rect width={W} height={H} fill={g} />
          <rect x={60} y={20} width={280} height={190} fill="none" stroke={a} strokeWidth={3} />
          <path d="M200 20 V210 M60 115 H340" stroke={a} strokeWidth={3} />
          <path d="M150 210 L250 210 L236 290 L164 290 Z" fill={f} stroke={a} strokeWidth={3} />
          <path d="M200 210 C 200 170 196 140 200 96" stroke={a} strokeWidth={4} fill="none" />
          <ellipse cx={176} cy={150} rx={26} ry={11} transform="rotate(-30 176 150)" fill={f} stroke={a} strokeWidth={2.5} />
          <ellipse cx={226} cy={128} rx={28} ry={12} transform="rotate(25 226 128)" fill={f} stroke={a} strokeWidth={2.5} />
          <ellipse cx={186} cy={104} rx={20} ry={9} transform="rotate(-40 186 104)" fill={f} stroke={a} strokeWidth={2.5} />
          <circle cx={200} cy={92} r={10} fill={v("--magenta")} stroke={a} strokeWidth={2.5} />
          <Title text={game.title} x={376} y={300} fill={a} size={40} anchor="end" max={8} />
        </>
      );
    case "weave": {
      const strips: React.ReactNode[] = [];
      for (let i = 0; i < 8; i++) {
        strips.push(<rect key={`v${i}`} x={14 + i * 48} y={0} width={30} height={H} fill={f} />);
      }
      for (let j = 0; j < 6; j++) {
        for (let i = 0; i < 8; i++) {
          const over = (i + j) % 2 === 0;
          strips.push(
            <rect key={`h${j}-${i}`} x={i * 48 + (over ? 0 : 44)} y={10 + j * 52} width={over ? 48 : 4} height={30} fill={a} />,
          );
        }
      }
      return (
        <>
          <rect width={W} height={H} fill={g} />
          {strips}
          <rect x={0} y={232} width={W} height={88} fill={g} />
          <Title text={game.title} x={24} y={302} fill={v("--ink")} size={64} max={16} />
        </>
      );
    }
    case "door":
      return (
        <>
          <rect width={W} height={H} fill={g} />
          <rect x={134} y={40} width={132} height={250} fill={f} />
          <path d="M266 40 L300 52 L300 302 L266 290 Z" fill={v("--ink")} opacity={0.5} />
          <rect x={160} y={80} width={80} height={36} rx={4} fill={a} />
          <text x={200} y={108} textAnchor="middle" fill={f} style={{ fontFamily: "var(--display)", fontStretch: "70%", fontWeight: 900, fontSize: 28 }}>
            404
          </text>
          <circle cx={244} cy={176} r={7} fill={a} />
          <path d="M0 290 H400" stroke={v("--ink")} strokeWidth={3} />
          <path d="M140 290 L60 320 M260 290 L340 320" stroke={v("--ink")} strokeWidth={2} opacity={0.4} />
          <Title text={game.title} x={24} y={58} fill={v("--ink")} size={46} max={7} top />
        </>
      );
    case "boat":
      return (
        <>
          <rect width={W} height={H} fill={g} />
          {[0, 1, 2, 3].map((i) => (
            <path
              key={i}
              d={`M0 ${200 + i * 30} Q 50 ${190 + i * 30} 100 ${200 + i * 30} T 200 ${200 + i * 30} T 300 ${200 + i * 30} T 400 ${200 + i * 30}`}
              stroke={f}
              strokeOpacity={0.5 - i * 0.1}
              strokeWidth={3}
              fill="none"
            />
          ))}
          <path d="M130 190 L270 190 L240 220 L160 220 Z" fill={f} />
          <path d="M200 100 L200 190 L140 190 Z" fill={f} opacity={0.85} />
          <path d="M200 100 L200 190 L260 190 Z" fill={f} />
          <path d="M200 100 V190" stroke={g} strokeWidth={2} />
          <ellipse cx={320} cy={120} rx={30} ry={13} transform="rotate(-25 320 120)" fill={a} />
          <path d="M296 130 L344 108" stroke={g} strokeWidth={2} />
          <Title text={game.title} x={24} y={58} fill={f} size={46} max={6} top />
        </>
      );
    case "scrap":
      return (
        <>
          <rect width={W} height={H} fill={g} />
          <rect x={0} y={228} width={W} height={20} fill={f} />
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
            <circle key={i} cx={20 + i * 40} cy={238} r={6} fill={g} />
          ))}
          <rect x={50} y={150} width={44} height={78} rx={6} fill={f} />
          <rect x={50} y={168} width={44} height={14} fill={a} />
          <circle cx={170} cy={186} r={42} fill={a} stroke={f} strokeWidth={4} />
          <circle cx={170} cy={186} r={14} fill={f} />
          <path d="M250 228 l10 -12 l-20 -10 l20 -10 l-20 -10 l20 -10 l-20 -10 l20 -10 l-10 -10" stroke={f} strokeWidth={5} fill="none" strokeLinejoin="round" />
          <rect x={300} y={174} width={70} height={54} fill={f} />
          <rect x={312} y={160} width={46} height={14} fill={f} />
          {[40, 90, 150, 210, 300, 350].map((x, i) => (
            <path key={x} d={`M${x} ${110 - (i % 2) * 20} v -16 M${x - 8} ${102 - (i % 2) * 20} h16`} stroke={f} strokeWidth={3} opacity={0.5} />
          ))}
          <Title text={game.title} x={24} y={300} fill={f} size={36} max={24} />
        </>
      );
    case "bus":
      return (
        <>
          <rect width={W} height={H} fill={v("--ultra")} />
          <circle cx={330} cy={60} r={26} fill={a} />
          <circle cx={340} cy={52} r={22} fill={v("--ultra")} />
          <rect x={30} y={130} width={320} height={110} rx={14} fill={g} stroke={v("--ink")} strokeWidth={3} />
          {[0, 1, 2, 3, 4].map((i) => (
            <rect key={i} x={50 + i * 52} y={148} width={40} height={40} rx={4} fill={i === 2 ? v("--ink") : a} />
          ))}
          <rect x={318} y={148} width={22} height={70} rx={3} fill={v("--ink")} opacity={0.6} />
          <circle cx={92} cy={244} r={20} fill={v("--ink")} />
          <circle cx={290} cy={244} r={20} fill={v("--ink")} />
          <path d="M0 268 H400" stroke={v("--paper")} strokeWidth={3} strokeDasharray="24 16" />
          <Title text={game.title} x={24} y={60} fill={v("--paper")} size={46} max={20} top />
        </>
      );
    case "golem":
      return (
        <>
          <rect width={W} height={H} fill={g} />
          {Array.from({ length: 10 }).map((_, i) => (
            <rect key={i} x={i * 40} y={260} width={40} height={60} fill={f} opacity={i % 2 ? 0.85 : 1} />
          ))}
          <rect x={228} y={84} width={84} height={70} fill={f} />
          <rect x={244} y={106} width={16} height={12} fill={a} />
          <rect x={280} y={106} width={16} height={12} fill={a} />
          <rect x={210} y={154} width={120} height={80} fill={f} />
          <rect x={256} y={176} width={28} height={28} fill={a} />
          <rect x={176} y={160} width={30} height={72} fill={f} />
          <rect x={334} y={160} width={30} height={72} fill={f} />
          <rect x={224} y={234} width={36} height={26} fill={f} />
          <rect x={280} y={234} width={36} height={26} fill={f} />
          <Title text={game.title} x={24} y={62} fill={f} size={50} max={6} top />
        </>
      );
    case "tide":
      return (
        <>
          <rect width={W} height={H} fill={g} />
          <circle cx={310} cy={70} r={32} fill={f} />
          {[0, 1, 2].map((i) => (
            <path
              key={i}
              d={`M0 ${170 + i * 26} C 80 ${160 + i * 26} 120 ${185 + i * 26} 200 ${172 + i * 26} S 340 ${160 + i * 26} 400 ${172 + i * 26}`}
              stroke={a}
              strokeOpacity={0.55 - i * 0.12}
              strokeWidth={3}
              fill="none"
            />
          ))}
          {[60, 120, 300, 350].map((x, i) => (
            <g key={x} stroke={a} strokeWidth={4} fill="none">
              <path d={`M${x} 250 C ${x - 10} 200 ${x + 10} 160 ${x} 110`} />
              <path d={`M${x} 200 C ${x - 26} 210 ${x - 30} 240 ${x - 34} 260`} />
              <path d={`M${x} 190 C ${x + 22} 210 ${x + 30} 240 ${x + 32} 262`} />
              <circle cx={x} cy={102} r={18 + (i % 2) * 6} fill={a} stroke="none" />
            </g>
          ))}
          <path d="M190 120 L190 210" stroke={a} strokeWidth={2} />
          <path d="M190 210 q -6 10 6 14" stroke={f} strokeWidth={3} fill="none" />
          <Title text={game.title} x={24} y={300} fill={a} size={50} max={20} />
        </>
      );
    case "shelves": {
      // A bookcase with one empty slot, and the rings a footstep makes on the floor.
      const books: React.ReactNode[] = [];
      [100, 190].forEach((py, si) => {
        let x = 36;
        let k = 0;
        while (x < 360) {
          const w = 13 + Math.floor(r() * 13);
          const h = 46 + Math.floor(r() * 24);
          if (x + w > 362) break;
          if (si === 1 && k === 4) {
            books.push(
              <rect key="gap" x={x} y={py - 62} width={w + 8} height={62} rx={2} fill="none" stroke={a} strokeWidth={2} strokeDasharray="5 4" />,
            );
            x += w + 12;
            k++;
            continue;
          }
          const tone = r();
          const fill = tone < 0.5 ? f : tone < 0.75 ? a : g;
          books.push(<rect key={`b${si}-${k}`} x={x} y={py - h} width={w} height={h} rx={2} fill={fill} stroke={f} strokeWidth={2} />);
          if (h > 54) {
            books.push(<rect key={`s${si}-${k}`} x={x + 3} y={py - h + 9} width={w - 6} height={4} fill={fill === f ? a : f} />);
          }
          x += w + 2;
          k++;
        }
      });
      return (
        <>
          <rect width={W} height={H} fill={g} />
          <rect x={22} y={14} width={356} height={10} fill={f} />
          <rect x={22} y={14} width={10} height={186} fill={f} />
          <rect x={368} y={14} width={10} height={186} fill={f} />
          {books}
          <rect x={22} y={100} width={356} height={10} fill={f} />
          <rect x={22} y={190} width={356} height={10} fill={f} />
          {[22, 46, 70].map((rx, i) => (
            <ellipse key={rx} cx={304} cy={262} rx={rx} ry={rx * 0.34} fill="none" stroke={a} strokeWidth={2.5} opacity={1 - i * 0.3} />
          ))}
          <ellipse cx={304} cy={262} rx={9} ry={4} fill={f} />
          <Title text={game.title} x={24} y={300} fill={f} size={46} max={10} />
        </>
      );
    }
    case "canoe": {
      // Flooded forest: trunks, their broken reflections, one canoe crossing.
      const WL = 150;
      const trees = [
        [34, 14, 46, 34],
        [94, 10, 70, 26],
        [152, 16, 30, 40],
        [262, 12, 58, 30],
        [320, 16, 22, 38],
        [376, 10, 66, 28],
      ];
      return (
        <>
          <rect width={W} height={H} fill={g} />
          {trees.map(([x, w, top, cr], i) => (
            <g key={i}>
              <circle cx={x} cy={top} r={cr} fill={f} />
              <rect x={x - w / 2} y={top} width={w} height={WL - top} fill={f} />
              <rect x={x - w / 2} y={WL} width={w} height={(WL - top) * 0.55} fill={f} opacity={0.35} />
            </g>
          ))}
          {[164, 180, 198].map((y, i) => (
            <path key={y} d={`M0 ${y} H${W}`} stroke={g} strokeWidth={3 + i} />
          ))}
          <path d={`M0 ${WL} H${W}`} stroke={a} strokeWidth={2.5} />
          <path d="M96 206 Q 200 240 304 206 Q 200 224 96 206 Z" fill={a} />
          <circle cx={214} cy={182} r={9} fill={a} />
          <path d="M205 212 L209 194 H221 L225 212 Z" fill={a} />
          <path d="M194 178 L242 238" stroke={a} strokeWidth={4} strokeLinecap="round" />
          <ellipse cx={244} cy={242} rx={6} ry={12} transform="rotate(-38 244 242)" fill={a} />
          {[
            [62, 228, 40],
            [300, 232, 48],
            [266, 254, 28],
          ].map(([x, y, w], i) => (
            <path key={i} d={`M${x} ${y} h${w}`} stroke={a} strokeWidth={2.5} strokeLinecap="round" opacity={0.5} />
          ))}
          <Title text={game.title} x={24} y={300} fill={a} size={54} max={14} />
        </>
      );
    }
    case "pendulum": {
      // A playground swing caught at three points of its arc.
      const px = 200;
      const py = 46;
      const L = 166;
      const arc = (deg: number) => {
        const t = (deg * Math.PI) / 180;
        return `${px + L * Math.sin(t)} ${py + L * Math.cos(t)}`;
      };
      const swing = (deg: number, op: number) => (
        <g key={deg} opacity={op} transform={`rotate(${-deg} ${px} ${py})`}>
          <path d={`M${px - 18} ${py} V${py + L} M${px + 18} ${py} V${py + L}`} stroke={f} strokeWidth={3} />
          <rect x={px - 26} y={py + L - 2} width={52} height={8} rx={2} fill={f} />
          <rect x={px - 8} y={py + L - 34} width={16} height={32} rx={3} fill={f} />
          <circle cx={px} cy={py + L - 46} r={11} fill={f} />
          <path d={`M${px + 4} ${py + L + 4} L${px + 34} ${py + L - 6}`} stroke={f} strokeWidth={7} strokeLinecap="round" />
        </g>
      );
      return (
        <>
          <rect width={W} height={H} fill={g} />
          <circle cx={384} cy={128} r={58} fill={a} />
          <circle cx={346} cy={84} r={36} fill={a} />
          <path d={`M${arc(-52)} A ${L} ${L} 0 0 0 ${arc(52)}`} fill="none" stroke={a} strokeWidth={2.5} strokeDasharray="6 9" />
          <path d="M62 44 L26 262 M62 44 L98 262 M338 44 L302 262 M338 44 L374 262" stroke={f} strokeWidth={8} strokeLinecap="round" />
          <rect x={40} y={36} width={320} height={12} rx={3} fill={f} />
          {swing(-34, 0.2)}
          {swing(-10, 0.4)}
          {swing(30, 1)}
          <rect y={262} width={W} height={H - 262} fill={f} />
          <Title text={game.title} x={24} y={304} fill={g} size={44} max={20} />
        </>
      );
    }
    case "drum": {
      // A frame drum seen from above, mid-beat, with the rhythm written underneath.
      const cx = 236;
      const cy = 136;
      const pegs = Array.from({ length: 14 }).map((_, i) => {
        const t = (i / 14) * Math.PI * 2;
        const x = cx + 104 * Math.cos(t);
        const y = cy + 104 * Math.sin(t);
        return <rect key={i} x={x - 5} y={y - 5} width={10} height={10} rx={2} fill={g} transform={`rotate(${(t * 180) / Math.PI} ${x} ${y})`} />;
      });
      let rx = 196;
      const beats = [0, 0, 1, 0, 1, 0].map((long, i) => {
        const w = long ? 38 : 14;
        const el = <rect key={i} x={rx} y={280} width={w} height={14} rx={7} fill={f} />;
        rx += w + 8;
        return el;
      });
      return (
        <>
          <rect width={W} height={H} fill={g} />
          <circle cx={36} cy={44} r={70} fill={f} />
          <circle cx={36} cy={44} r={56} fill={a} />
          <circle cx={cx} cy={cy} r={116} fill={f} />
          {pegs}
          <circle cx={cx} cy={cy} r={92} fill={a} />
          {[30, 46, 62].map((rr, i) => (
            <circle key={rr} cx={cx - 20} cy={cy - 16} r={rr} fill="none" stroke={f} strokeWidth={3} opacity={0.7 - i * 0.22} />
          ))}
          <circle cx={cx - 20} cy={cy - 16} r={15} fill={f} />
          {beats}
          <Title text={game.title} x={24} y={300} fill={f} size={56} max={12} />
        </>
      );
    }
  }
}

export function Cover({ game, label, fit = "slice" }: { game: Game; label?: string; fit?: "slice" | "meet" }) {
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role={label === "" ? undefined : "img"}
      aria-hidden={label === "" ? true : undefined}
      aria-label={label === "" ? undefined : (label ?? `Capa de ${game.title}`)}
      preserveAspectRatio={`xMidYMid ${fit}`}
      style={{ width: "100%", height: "auto", aspectRatio: `${W} / ${H}` }}
    >
      <Art game={game} />
    </svg>
  );
}
