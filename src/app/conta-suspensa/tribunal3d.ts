import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import type { EvidenceKind } from "./casos";

/*
 * O tribunal do jogo "O Recurso", em primeira pessoa e com materiais físicos
 * (PBR). Tudo é código: as texturas (madeira, mármore, tecido, couro) são
 * desenhadas em canvas na hora, os móveis e os juízes saem de primitivas.
 * Luz: o ambiente (RoomEnvironment) para os reflexos, o sol entrando pelas
 * janelas da parede esquerda, spots quentes no teto e o abajur da mesa.
 *
 * Unidades em metros. O fundo da sala (z negativo) é a bancada dos juízes;
 * a mesa da defesa e a tribuna ficam no meio; a galeria, atrás.
 */

export type Station = "intro" | "mesa" | "tribuna";
export interface EvidenceView {
  id: string;
  kind: EvidenceKind;
  title: string;
  text: string;
}
export interface TribunalView {
  setEvidence(list: EvidenceView[]): void;
  setPicked(ids: string[]): void;
  goTo(station: Station, walk?: boolean): Promise<void>;
  focusJudge(i: number | null): void;
  setSpeaking(i: number | null): void;
  setLean(lean: number[]): void;
  setVotes(votes: (boolean | null)[]): void;
  /** Gira a câmera (teclado: setas), em radianos. */
  nudge(yaw: number, pitch: number): void;
  resize(): void;
  dispose(): void;
}

interface Options {
  names: string[];
  reduced: boolean;
  onPick(id: string): void;
  onHover(id: string | null): void;
  onStep(): void;
}

/** Ordem dos assentos da esquerda para a direita; a presidente (4) no meio. */
const SEAT_X = [-4.6, -2.3, 2.3, 4.6, 0];
const BENCH_FRONT = -5.6;
const JUDGE_Z = -6.55;
const PLATFORM = 0.62;
const JUDGE_SCALE = 1.3;
/** Altura do centro da cabeça de um juiz, no mundo. */
const HEAD_Y = PLATFORM + 1.84 * JUDGE_SCALE;

/* ------------------------------------------------------------------ */
/* Texturas desenhadas em código                                       */
/* ------------------------------------------------------------------ */

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvas(w: number, h = w) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return { c, x: c.getContext("2d")! };
}

function tex(c: HTMLCanvasElement, repeat: [number, number] = [1, 1], color = true) {
  const t = new THREE.CanvasTexture(c);
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat);
  t.anisotropy = 8;
  return t;
}

/** Madeira: veios verticais ondulados e alguns nós; a rugosidade segue os veios. */
function woodTextures(base: string, grain: string, seed: number) {
  const r = rng(seed);
  const { c, x } = canvas(512);
  const { c: rc, x: rx } = canvas(512);
  x.fillStyle = base;
  x.fillRect(0, 0, 512, 512);
  rx.fillStyle = "#8a8a8a";
  rx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 140; i++) {
    const x0 = r() * 512;
    const amp = 2 + r() * 6;
    const freq = 0.01 + r() * 0.02;
    const ph = r() * 6;
    x.strokeStyle = grain;
    x.globalAlpha = 0.05 + r() * 0.22;
    x.lineWidth = 0.6 + r() * 2.2;
    rx.strokeStyle = r() > 0.5 ? "#a0a0a0" : "#707070";
    rx.globalAlpha = 0.3;
    rx.lineWidth = x.lineWidth;
    for (const g of [x, rx]) {
      g.beginPath();
      for (let y = 0; y <= 512; y += 8) {
        const px = x0 + Math.sin(y * freq + ph) * amp + Math.sin(y * 0.003 + ph) * 12;
        if (y === 0) g.moveTo(px, y);
        else g.lineTo(px, y);
      }
      g.stroke();
    }
  }
  x.globalAlpha = 1;
  for (let i = 0; i < 3; i++) {
    const kx = r() * 512;
    const ky = r() * 512;
    for (let k = 0; k < 6; k++) {
      x.strokeStyle = grain;
      x.globalAlpha = 0.25;
      x.beginPath();
      x.ellipse(kx, ky, 3 + k * 3, 8 + k * 6, 0, 0, Math.PI * 2);
      x.stroke();
    }
  }
  x.globalAlpha = 1;
  return { map: tex(c), rough: tex(rc, [1, 1], false) };
}

/** Mármore em ladrilhos de 1 m: veias cinza desfocadas e rejunte fino. */
function marbleTextures(seed: number) {
  const r = rng(seed);
  const { c, x } = canvas(1024);
  x.fillStyle = "#e9e6df";
  x.fillRect(0, 0, 1024, 1024);
  x.filter = "blur(1.5px)";
  for (let v = 0; v < 26; v++) {
    let px = r() * 1024;
    let py = r() * 1024;
    let a = r() * Math.PI * 2;
    x.strokeStyle = r() > 0.3 ? "#9b978f" : "#6e6a63";
    x.globalAlpha = 0.15 + r() * 0.35;
    x.lineWidth = 0.6 + r() * 2.6;
    x.beginPath();
    x.moveTo(px, py);
    for (let s = 0; s < 90; s++) {
      a += (r() - 0.5) * 0.6;
      px += Math.cos(a) * 9;
      py += Math.sin(a) * 9;
      x.lineTo(px, py);
    }
    x.stroke();
  }
  x.filter = "none";
  x.globalAlpha = 1;
  // Um tom levemente diferente por ladrilho e o rejunte.
  for (let i = 0; i < 2; i++)
    for (let j = 0; j < 2; j++) {
      x.fillStyle = `rgba(${r() > 0.5 ? "255,250,240" : "120,115,105"},${0.04 + r() * 0.05})`;
      x.fillRect(i * 512, j * 512, 512, 512);
    }
  x.strokeStyle = "#8f8a80";
  x.lineWidth = 3;
  x.strokeRect(0, 0, 512, 512);
  x.strokeRect(512, 0, 512, 512);
  x.strokeRect(0, 512, 512, 512);
  x.strokeRect(512, 512, 512, 512);
  const { c: rc, x: rx } = canvas(256);
  rx.fillStyle = "#3a3a3a";
  rx.fillRect(0, 0, 256, 256);
  rx.strokeStyle = "#cfcfcf";
  rx.lineWidth = 3;
  rx.strokeRect(0, 0, 128, 128);
  rx.strokeRect(128, 128, 128, 128);
  rx.strokeRect(128, 0, 128, 128);
  rx.strokeRect(0, 128, 128, 128);
  return { map: tex(c, [10, 10]), rough: tex(rc, [10, 10], false) };
}

/** Ruído fino para tecido, gesso e couro. */
function noiseTexture(base: string, dots: string, amount: number, seed: number, size = 256) {
  const r = rng(seed);
  const { c, x } = canvas(size);
  x.fillStyle = base;
  x.fillRect(0, 0, size, size);
  for (let i = 0; i < amount; i++) {
    x.fillStyle = dots;
    x.globalAlpha = r() * 0.18;
    x.fillRect(r() * size, r() * size, 1 + r() * 2, 1 + r() * 2);
  }
  x.globalAlpha = 1;
  return c;
}

/** Texto em várias linhas numa folha (documentos, telas, placas). */
function wrapText(x: CanvasRenderingContext2D, text: string, left: number, top: number, width: number, line: number, maxLines = 30) {
  const words = text.split(/\s+/);
  let cur = "";
  let y = top;
  let n = 0;
  for (const w of words) {
    const tryLine = cur ? `${cur} ${w}` : w;
    if (x.measureText(tryLine).width > width && cur) {
      x.fillText(cur, left, y);
      cur = w;
      y += line;
      if (++n >= maxLines) return y;
    } else cur = tryLine;
  }
  if (cur) x.fillText(cur, left, y);
  return y + line;
}

/* ------------------------------------------------------------------ */
/* A cena                                                              */
/* ------------------------------------------------------------------ */

export function createTribunal(cnv: HTMLCanvasElement, opts: Options): TribunalView {
  const small = window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 700;
  const renderer = new THREE.WebGLRenderer({ canvas: cnv, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small ? 1.25 : 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x15120f);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new RoomEnvironment();
  const env = pmrem.fromScene(envScene, 0.04).texture;
  scene.environment = env;
  scene.environmentIntensity = 0.42;
  envScene.dispose();

  const camera = new THREE.PerspectiveCamera(55, 16 / 9, 0.05, 60);
  camera.rotation.order = "YXZ";

  /* ---------------- materiais ---------------- */
  const woodA = woodTextures("#5a3a24", "#2b170c", 11);
  const woodB = woodTextures("#3d2618", "#1a0d06", 23);
  const woodTone = (t: { map: THREE.Texture; rough: THREE.Texture }, rep: [number, number], rough = 0.55) => {
    const map = t.map.clone();
    const rmap = t.rough.clone();
    map.repeat.set(...rep);
    rmap.repeat.set(...rep);
    map.needsUpdate = rmap.needsUpdate = true;
    return new THREE.MeshStandardMaterial({ map, roughnessMap: rmap, roughness: rough, metalness: 0 });
  };
  const wood = woodTone(woodA, [2, 1]);
  const woodDark = woodTone(woodB, [2, 1], 0.45);
  const woodPanel = woodTone(woodA, [1, 1], 0.6);
  const marble = marbleTextures(7);
  const floorMat = new THREE.MeshStandardMaterial({ map: marble.map, roughnessMap: marble.rough, roughness: 0.32, metalness: 0 });
  const plaster = new THREE.MeshStandardMaterial({ map: tex(noiseTexture("#d9d2c3", "#6b6253", 9000, 3), [6, 3]), roughness: 0.92 });
  const ceilingMat = new THREE.MeshStandardMaterial({ map: tex(noiseTexture("#e6e0d4", "#7a7060", 6000, 5), [8, 8]), roughness: 0.95 });
  const fabricTex = tex(noiseTexture("#18181d", "#5a5a66", 14000, 9), [6, 6]);
  const robe = new THREE.MeshStandardMaterial({ map: fabricTex, roughness: 0.88, color: 0xffffff });
  const carpet = new THREE.MeshStandardMaterial({ map: tex(noiseTexture("#6d1220", "#2a0308", 16000, 13), [2, 10]), roughness: 0.97 });
  const leather = new THREE.MeshStandardMaterial({ map: tex(noiseTexture("#4a1410", "#120302", 9000, 17), [2, 2]), roughness: 0.48 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xb48a4e, metalness: 1, roughness: 0.32 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x9ea3a8, metalness: 1, roughness: 0.28 });
  const blackPlastic = new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.45 });
  const paper = new THREE.MeshStandardMaterial({ color: 0xf3f0e8, roughness: 0.9 });
  const ceramic = new THREE.MeshPhysicalMaterial({ color: 0xeceae4, roughness: 0.34, clearcoat: 1, clearcoatRoughness: 0.12 });
  const visorGlass = new THREE.MeshPhysicalMaterial({ color: 0x07080b, roughness: 0.06, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.04 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xdfe8ea, roughness: 0.04, transmission: 0.0, transparent: true, opacity: 0.28, clearcoat: 1 });
  const white = new THREE.MeshStandardMaterial({ color: 0xf6f4ee, roughness: 0.85 });

  const add = <T extends THREE.Object3D>(o: T, parent: THREE.Object3D = scene): T => {
    o.traverse((m) => {
      if (m instanceof THREE.Mesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
    parent.add(o);
    return o;
  };
  const box = (w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number, parent?: THREE.Object3D) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    return add(m, parent);
  };
  const rbox = (w: number, h: number, d: number, r: number, mat: THREE.Material, x: number, y: number, z: number, parent?: THREE.Object3D) => {
    const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, r), mat);
    m.position.set(x, y, z);
    return add(m, parent);
  };
  const cyl = (rt: number, rb: number, h: number, mat: THREE.Material, x: number, y: number, z: number, seg = 20, parent?: THREE.Object3D) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
    m.position.set(x, y, z);
    return add(m, parent);
  };

  /* ---------------- sala ---------------- */
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.z = 1;
  floor.receiveShadow = true;
  scene.add(floor);
  const runner = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 12), carpet);
  runner.rotation.x = -Math.PI / 2;
  runner.position.set(0, 0.006, 4.8);
  runner.receiveShadow = true;
  scene.add(runner);
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), ceilingMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, 7, 1);
  scene.add(ceiling);
  // Vigas do forro e as luminárias embutidas.
  for (let i = -3; i <= 3; i++) box(0.3, 0.35, 20, woodDark, i * 3, 6.82, 1);
  for (let k = -3; k <= 3; k++) box(20, 0.3, 0.3, woodDark, 0, 6.84, k * 3 + 1);
  const lampPanel = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffe2b8, emissiveIntensity: 2.2 });
  for (const lx of [-4.5, 0, 4.5]) for (const lz of [-5.5, -1, 3.5, 8]) {
    const p = new THREE.Mesh(new THREE.CircleGeometry(0.28, 24), lampPanel);
    p.rotation.x = Math.PI / 2;
    p.position.set(lx, 6.99, lz);
    scene.add(p);
  }

  // Paredes: fundo, direita e a da entrada; a esquerda é montada em volta das janelas.
  const wall = (w: number, h: number, x: number, y: number, z: number, ry: number) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), plaster);
    m.position.set(x, y, z);
    m.rotation.y = ry;
    m.receiveShadow = true;
    scene.add(m);
  };
  wall(20, 7, 0, 3.5, -9, 0);
  wall(20, 7, 10, 3.5, 1, -Math.PI / 2);
  wall(20, 7, 0, 3.5, 11, Math.PI);
  const WIN_Z = [-5, -1, 3, 7];
  const WIN_LOW = 2.1;
  const WIN_HIGH = 5.7;
  const WIN_W = 1.5;
  box(0.3, WIN_LOW, 20, plaster, -10.15, WIN_LOW / 2, 1);
  box(0.3, 7 - WIN_HIGH, 20, plaster, -10.15, (7 + WIN_HIGH) / 2, 1);
  let zPrev = -9;
  for (const wz of [...WIN_Z, 11 + WIN_W / 2]) {
    const a = zPrev;
    const b = wz - WIN_W / 2;
    if (b > a) box(0.3, WIN_HIGH - WIN_LOW, b - a, plaster, -10.15, (WIN_LOW + WIN_HIGH) / 2, (a + b) / 2);
    zPrev = wz + WIN_W / 2;
  }
  // Céu claro do lado de fora e os caixilhos.
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(30, 12), new THREE.MeshBasicMaterial({ color: 0xfff3dc }));
  sky.position.set(-13, 4, 1);
  sky.rotation.y = Math.PI / 2;
  scene.add(sky);
  for (const wz of WIN_Z) {
    box(0.12, WIN_HIGH - WIN_LOW, 0.06, woodDark, -10.0, (WIN_LOW + WIN_HIGH) / 2, wz);
    box(0.12, 0.06, WIN_W, woodDark, -10.0, (WIN_LOW + WIN_HIGH) / 2 + 0.6, wz);
    box(0.4, 0.08, WIN_W + 0.2, woodDark, -9.9, WIN_LOW, wz);
  }

  // Lambris de madeira em volta da sala.
  const wainscot = (len: number, x: number, z: number, ry: number) => {
    const g = new THREE.Group();
    box(len, 1.3, 0.06, woodPanel, 0, 0.65, 0, g);
    box(len, 0.08, 0.1, woodDark, 0, 1.32, 0.02, g);
    for (let i = 0; i < Math.floor(len / 1.4); i++) {
      const px = -len / 2 + 0.7 + i * 1.4;
      box(1.15, 0.9, 0.03, woodDark, px, 0.66, 0.045, g);
      box(1.0, 0.75, 0.03, woodPanel, px, 0.66, 0.06, g);
    }
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    add(g);
  };
  wainscot(20, 0, -8.96, 0);
  wainscot(20, 9.96, 1, -Math.PI / 2);
  wainscot(20, 0, 10.96, Math.PI);

  // Fundo da bancada: painéis altos, colunas de madeira, o brasão de latão e o relógio.
  box(14, 4.6, 0.12, woodPanel, 0, 2.3 + PLATFORM, -8.9);
  for (const px of [-6.8, -3.4, 3.4, 6.8]) box(0.45, 5.4, 0.3, woodDark, px, 2.7, -8.75);
  box(14.4, 0.25, 0.4, woodDark, 0, 5.5, -8.75);
  const emblem = new THREE.Group();
  add(new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.07, 16, 64), brass), emblem);
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.88, 0.88, 0.05, 48), woodDark), emblem).rotation.x = Math.PI / 2;
  cyl(0.025, 0.025, 1.2, brass, 0, -0.05, 0.06, 12, emblem);
  box(1.2, 0.05, 0.05, brass, 0, 0.5, 0.06, emblem);
  for (const sx of [-0.55, 0.55]) {
    cyl(0.006, 0.006, 0.4, brass, sx, 0.3, 0.06, 6, emblem);
    const pan = add(new THREE.Mesh(new THREE.SphereGeometry(0.16, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), brass), emblem);
    pan.position.set(sx, 0.1, 0.06);
  }
  emblem.position.set(0, 4.55, -8.78);
  scene.add(emblem);

  const clock = canvas(256);
  const clockTex = tex(clock.c);
  const drawClock = () => {
    const x = clock.x;
    const now = new Date();
    x.fillStyle = "#f4efe2";
    x.beginPath();
    x.arc(128, 128, 124, 0, Math.PI * 2);
    x.fill();
    x.strokeStyle = "#1a1a1a";
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2;
      const l = i % 5 ? 8 : 18;
      x.lineWidth = i % 5 ? 2 : 5;
      x.beginPath();
      x.moveTo(128 + Math.sin(a) * (118 - l), 128 - Math.cos(a) * (118 - l));
      x.lineTo(128 + Math.sin(a) * 116, 128 - Math.cos(a) * 116);
      x.stroke();
    }
    const hand = (a: number, len: number, w: number) => {
      x.lineWidth = w;
      x.lineCap = "round";
      x.beginPath();
      x.moveTo(128, 128);
      x.lineTo(128 + Math.sin(a) * len, 128 - Math.cos(a) * len);
      x.stroke();
    };
    const h = now.getHours() % 12;
    const m = now.getMinutes();
    hand(((h + m / 60) / 12) * Math.PI * 2, 60, 8);
    hand((m / 60) * Math.PI * 2, 92, 5);
    clockTex.needsUpdate = true;
  };
  drawClock();
  const clockTimer = window.setInterval(drawClock, 30_000);
  const clockFace = new THREE.Mesh(new THREE.CircleGeometry(0.42, 48), new THREE.MeshStandardMaterial({ map: clockTex, roughness: 0.4 }));
  clockFace.position.set(9.92, 4.8, -4);
  clockFace.rotation.y = -Math.PI / 2;
  scene.add(clockFace);
  const clockRim = add(new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.04, 12, 48), brass));
  clockRim.position.copy(clockFace.position);
  clockRim.rotation.y = -Math.PI / 2;

  /* ---------------- bancada ---------------- */
  box(14, PLATFORM, 3.4, woodDark, 0, PLATFORM / 2, -7.3);
  box(14.4, 0.2, 0.5, woodDark, 0, 0.1, -5.35);
  // Fachada da bancada: alta na frente (os juízes aparecem do peito para cima).
  const FACE_H = 1.15;
  box(13, FACE_H, 0.12, wood, 0, PLATFORM + FACE_H / 2, BENCH_FRONT);
  box(13.3, 0.1, 0.55, woodDark, 0, PLATFORM + FACE_H + 0.05, BENCH_FRONT - 0.15);
  box(13, 0.05, 0.05, brass, 0, PLATFORM + FACE_H - 0.1, BENCH_FRONT + 0.07);
  box(12.4, 0.05, 0.9, woodDark, 0, PLATFORM + 0.78, BENCH_FRONT - 0.6);
  // A parte da presidente é um pouco mais alta.
  box(2.2, 0.25, 0.14, wood, 0, PLATFORM + FACE_H + 0.12, BENCH_FRONT + 0.01);
  const nameplates: THREE.Mesh[] = [];
  const voteLamps: THREE.MeshStandardMaterial[] = [];
  opts.names.forEach((name, i) => {
    const sx = SEAT_X[i];
    // Painel com moldura.
    box(1.7, 0.75, 0.04, woodDark, sx, PLATFORM + 0.5, BENCH_FRONT + 0.075);
    box(1.5, 0.6, 0.04, wood, sx, PLATFORM + 0.5, BENCH_FRONT + 0.09);
    // Plaquinha de latão com o nome gravado.
    const t = canvas(512, 96);
    const g = t.x;
    const grad = g.createLinearGradient(0, 0, 0, 96);
    grad.addColorStop(0, "#d8b878");
    grad.addColorStop(1, "#9c7440");
    g.fillStyle = grad;
    g.fillRect(0, 0, 512, 96);
    g.fillStyle = "#2a1a08";
    g.font = "600 42px Georgia, 'Times New Roman', serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(name.toUpperCase(), 256, 50, 480);
    const plate = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.2, 0.02), [
      brass,
      brass,
      brass,
      brass,
      new THREE.MeshStandardMaterial({ map: tex(t.c), metalness: 0.85, roughness: 0.35 }),
      brass,
    ]);
    plate.position.set(sx, PLATFORM + FACE_H - 0.28, BENCH_FRONT + 0.08);
    nameplates.push(add(plate));
    // Lâmpada do voto: apagada até a votação.
    const lampMat = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0x000000, roughness: 0.2 });
    voteLamps.push(lampMat);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 12), lampMat);
    lamp.position.set(sx + 0.7, PLATFORM + FACE_H - 0.28, BENCH_FRONT + 0.1);
    scene.add(lamp);
  });

  /* ---------------- juízes ---------------- */
  interface JudgeRig {
    root: THREE.Group;
    torso: THREE.Mesh;
    head: THREE.Group;
    eye: THREE.MeshStandardMaterial;
    mic: THREE.MeshStandardMaterial;
  }
  const accents = [brass, steel, new THREE.MeshStandardMaterial({ color: 0xb06a3c, metalness: 1, roughness: 0.3 }), steel, brass];
  const judges: JudgeRig[] = opts.names.map((_, i) => {
    const root = new THREE.Group();
    const scale = 1.14;
    // Cadeira de espaldar alto, de couro.
    const president = i === 4;
    rbox(0.86, president ? 1.75 : 1.45, 0.18, 0.06, leather, 0, PLATFORM + (president ? 1.32 : 1.18), 0.42, root);
    rbox(0.8, 0.14, 0.7, 0.05, leather, 0, PLATFORM + 0.5, 0.05, root);
    for (const sx of [-0.43, 0.43]) rbox(0.08, 0.08, 0.6, 0.03, woodDark, sx, PLATFORM + 0.72, 0.05, root);
    // Tronco de toga (perfil girado) e os ombros.
    const profile = [
      [0.0, 0.0],
      [0.3, 0.0],
      [0.34, 0.25],
      [0.38, 0.5],
      [0.44, 0.7],
      [0.42, 0.78],
      [0.3, 0.84],
      [0.1, 0.88],
      [0.0, 0.88],
    ].map(([r, y]) => new THREE.Vector2(r * scale, y * scale));
    const torso = add(new THREE.Mesh(new THREE.LatheGeometry(profile, 32), robe), root);
    torso.scale.z = 0.72;
    torso.position.y = PLATFORM + 0.55;
    // Peitilho branco em duas abas.
    for (const sx of [-0.045, 0.045]) {
      const tab = box(0.08, 0.22, 0.012, white, sx, PLATFORM + 1.37, -0.3, root);
      tab.rotation.set(0.25, 0, sx * 1.2);
    }
    // Braços apoiados na mesa, mãos de cerâmica.
    for (const sx of [-1, 1]) {
      const arm = add(new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.42, 6, 14), robe), root);
      arm.position.set(sx * 0.4, PLATFORM + 1.08, -0.18);
      arm.rotation.set(-1.05, 0, sx * 0.15);
      const hand = rbox(0.1, 0.05, 0.14, 0.02, ceramic, sx * 0.3, PLATFORM + 0.84, -0.5, root);
      hand.rotation.y = sx * -0.3;
    }
    // Pescoço e cabeça: cerâmica com visor de vidro escuro e uma linha de luz (o "olhar").
    cyl(0.055, 0.07, 0.16, steel, 0, PLATFORM + 1.6, -0.02, 16, root);
    const head = new THREE.Group();
    head.position.set(0, PLATFORM + 1.84, -0.02);
    root.add(head);
    const shapes = [
      [1, 1.12, 0.98],
      [0.96, 1.05, 1.02],
      [0.92, 1.2, 0.95],
      [1.02, 1.0, 1.0],
      [0.98, 1.1, 1.0],
    ][i];
    const skull = add(new THREE.Mesh(new THREE.SphereGeometry(0.15, 40, 28), ceramic), head);
    skull.scale.set(shapes[0] * scale, shapes[1] * scale, shapes[2] * scale);
    const visor = add(new THREE.Mesh(new THREE.SphereGeometry(0.152, 40, 16, Math.PI * 0.18, Math.PI * 0.64, Math.PI * 0.36, Math.PI * 0.22), visorGlass), head);
    visor.scale.copy(skull.scale).multiplyScalar(1.01);
    visor.rotation.y = Math.PI;
    const eye = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffb000, emissiveIntensity: 2.4 });
    // Arco de luz centrado na frente do rosto (-z): centra o arco em +x, deita no plano XZ, gira para -z.
    const arc = Math.PI * 0.42;
    const lineGeo = new THREE.TorusGeometry(0.157 * scale * shapes[0], 0.006, 8, 40, arc).rotateZ(-arc / 2).rotateX(Math.PI / 2).rotateY(Math.PI / 2);
    const line = new THREE.Mesh(lineGeo, eye);
    line.position.y = 0.005;
    line.scale.z = shapes[2] / shapes[0];
    head.add(line);
    // Detalhe de cada fabricante: discos nas laterais.
    for (const sx of [-1, 1]) {
      const ear = cyl(0.04, 0.04, 0.03, accents[i], sx * 0.155 * scale * shapes[0], 0, 0, 24, head);
      ear.rotation.z = Math.PI / 2;
    }
    if (president) {
      const ring = add(new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.008, 8, 40), brass), head);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.16 * scale * shapes[1];
    }
    // Microfone de haste flexível.
    cyl(0.06, 0.07, 0.03, blackPlastic, 0.32, PLATFORM + 0.8, -0.6, 20, root);
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.32, PLATFORM + 0.81, -0.6),
      new THREE.Vector3(0.3, PLATFORM + 1.05, -0.58),
      new THREE.Vector3(0.22, PLATFORM + 1.22, -0.48),
      new THREE.Vector3(0.14, PLATFORM + 1.28, -0.42),
    ]);
    add(new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.008, 8), blackPlastic), root);
    const mic = new THREE.MeshStandardMaterial({ color: 0x151515, emissive: 0x000000, roughness: 0.4 });
    const micHead = add(new THREE.Mesh(new THREE.CapsuleGeometry(0.018, 0.05, 4, 10), mic), root);
    micHead.position.set(0.13, PLATFORM + 1.29, -0.4);
    micHead.rotation.x = 1.2;

    // O modelo foi montado olhando para -z; meia-volta e ele olha para a sala.
    // Maiores que gente (são máquinas, e o visor precisa ser lido da tribuna); a altura do estrado não escala.
    root.scale.setScalar(JUDGE_SCALE);
    root.position.set(SEAT_X[i], PLATFORM * (1 - JUDGE_SCALE), JUDGE_Z);
    root.rotation.y = Math.PI;
    scene.add(root);
    return { root, torso, head, eye, mic };
  });

  // Martelo e base na mesa da presidente; livros e jarra de água.
  const gavel = new THREE.Group();
  cyl(0.045, 0.045, 0.16, woodDark, 0, 0, 0, 20, gavel).rotation.z = Math.PI / 2;
  cyl(0.012, 0.014, 0.26, woodDark, 0, 0, 0.13, 10, gavel).rotation.x = Math.PI / 2;
  gavel.position.set(0.55, PLATFORM + 0.86, BENCH_FRONT - 0.5);
  gavel.rotation.y = 0.5;
  add(gavel);
  cyl(0.08, 0.09, 0.03, woodDark, 0.45, PLATFORM + 0.82, BENCH_FRONT - 0.45);
  for (const [bx, n] of [
    [-3.1, 3],
    [3.4, 2],
    [-5.4, 2],
  ] as const) {
    const colors = [0x5a1a14, 0x1c2a44, 0x2c3a1c];
    for (let k = 0; k < n; k++) rbox(0.42, 0.07, 0.3, 0.01, new THREE.MeshStandardMaterial({ color: colors[k % 3], roughness: 0.7 }), bx, PLATFORM + 0.84 + k * 0.07, BENCH_FRONT - 0.55);
  }
  cyl(0.06, 0.07, 0.24, glass, -1.1, PLATFORM + 0.93, BENCH_FRONT - 0.5, 24);

  /* ---------------- mesa da defesa, mesa da moderação, tribuna ---------------- */
  const TABLE = new THREE.Vector3(-3.2, 0.78, 4.0);
  const table = new THREE.Group();
  rbox(2.4, 0.06, 1.1, 0.015, woodDark, 0, 0, 0, table);
  for (const [lx, lz] of [
    [-1.1, -0.45],
    [1.1, -0.45],
    [-1.1, 0.45],
    [1.1, 0.45],
  ])
    box(0.07, 0.78, 0.07, woodDark, lx, -0.39, lz, table);
  box(2.3, 0.5, 0.03, wood, 0, -0.3, -0.5, table);
  // Abajur de banqueiro: base de latão, cúpula verde.
  cyl(0.09, 0.11, 0.03, brass, -0.95, 0.045, -0.35, 24, table);
  cyl(0.012, 0.012, 0.32, brass, -0.95, 0.2, -0.35, 8, table);
  // Cúpula: meio cilindro deitado, aberto para baixo (o eixo vira x; a metade vira para cima).
  const shade = add(new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.32, 24, 1, true, 0, Math.PI), new THREE.MeshPhysicalMaterial({ color: 0x1f6b3a, roughness: 0.15, clearcoat: 1, side: THREE.DoubleSide, emissive: 0x0b3a1a, emissiveIntensity: 0.6 })), table);
  shade.position.set(-0.95, 0.37, -0.3);
  shade.rotation.z = Math.PI / 2;
  cyl(0.008, 0.008, 0.08, brass, -0.95, 0.36, -0.33, 8, table).rotation.x = 0.6;
  const bulb = new THREE.PointLight(0xffb46b, 2.2, 3.2, 2);
  bulb.position.set(-0.95, 0.33, -0.3);
  table.add(bulb);
  // A pasta de couro onde ficam as provas escolhidas.
  rbox(0.5, 0.02, 0.36, 0.008, leather, 0.82, 0.04, 0.2, table);
  table.position.copy(TABLE);
  add(table);
  // Cadeira da defesa.
  rbox(0.55, 0.06, 0.5, 0.02, leather, TABLE.x, 0.48, TABLE.z + 1.05);
  rbox(0.55, 0.6, 0.06, 0.02, leather, TABLE.x, 0.8, TABLE.z + 1.3);

  const other = TABLE.clone().setX(3.2);
  rbox(2.4, 0.06, 1.1, 0.015, woodDark, other.x, other.y, other.z);
  for (const lx of [-1.1, 1.1]) for (const lz of [-0.45, 0.45]) box(0.07, 0.78, 0.07, woodDark, other.x + lx, 0.39, other.z + lz);
  box(0.3, 0.012, 0.4, paper, other.x - 0.4, other.y + 0.04, other.z);
  box(0.3, 0.012, 0.4, paper, other.x + 0.2, other.y + 0.045, other.z - 0.1).rotation.y = 0.3;

  const LECTERN = new THREE.Vector3(0, 0, -1.4);
  const lectern = new THREE.Group();
  box(0.7, 1.05, 0.5, wood, 0, 0.525, 0, lectern);
  const top = box(0.82, 0.05, 0.6, woodDark, 0, 1.12, 0.03, lectern);
  top.rotation.x = -0.25;
  box(0.9, 0.08, 0.6, woodDark, 0, 0.04, 0, lectern);
  cyl(0.008, 0.008, 0.35, blackPlastic, 0.25, 1.3, -0.15, 8, lectern).rotation.x = -0.4;
  lectern.position.copy(LECTERN);
  add(lectern);

  // Grade da galeria e bancos do público.
  box(8, 0.06, 0.08, woodDark, -5.1, 0.95, 6.5);
  box(8, 0.06, 0.08, woodDark, 5.1, 0.95, 6.5);
  for (let k = -9; k <= 9; k += 0.5) if (Math.abs(k) > 1.1) box(0.04, 0.9, 0.04, woodDark, k, 0.47, 6.5);
  for (const bz of [7.8, 9.0, 10.2])
    for (const bx of [-5, 5]) {
      box(7.2, 0.06, 0.45, wood, bx, 0.46, bz);
      box(7.2, 0.5, 0.05, wood, bx, 0.75, bz + 0.22);
      for (const lx of [-3.4, 0, 3.4]) box(0.06, 0.46, 0.4, woodDark, bx + lx, 0.23, bz);
    }

  /* ---------------- luzes ---------------- */
  scene.add(new THREE.HemisphereLight(0xfff4e0, 0x2a1d14, 0.35));
  const sun = new THREE.DirectionalLight(0xfff0d8, 3.4);
  sun.position.set(-17, 9.5, 0.5);
  sun.target.position.set(0, 0, 1.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 10, bottom: -10, near: 1, far: 40 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);
  const benchSpot = new THREE.SpotLight(0xffd2a0, 90, 0, 0.62, 0.65, 2);
  benchSpot.position.set(0, 6.8, -3.2);
  benchSpot.target.position.set(0, 2, -6.5);
  benchSpot.castShadow = !small;
  benchSpot.shadow.mapSize.set(1024, 1024);
  benchSpot.shadow.bias = -0.0005;
  scene.add(benchSpot, benchSpot.target);
  for (const sx of [-4.5, 4.5]) {
    const s = new THREE.SpotLight(0xffd2a0, 55, 0, 0.55, 0.7, 2);
    s.position.set(sx, 6.8, -3.4);
    s.target.position.set(sx, 2, -6.5);
    scene.add(s, s.target);
  }
  const roomSpot = new THREE.SpotLight(0xffe0bb, 80, 0, 0.95, 0.8, 2);
  roomSpot.position.set(0, 6.8, 3);
  roomSpot.target.position.set(0, 0, 3);
  scene.add(roomSpot, roomSpot.target);
  // Spot do juiz que fala.
  const talkSpot = new THREE.SpotLight(0xfff2dc, 0, 0, 0.22, 0.5, 2);
  talkSpot.position.set(0, 6.8, -4.2);
  scene.add(talkSpot, talkSpot.target);

  // Fachos de luz das janelas e a poeira dentro deles.
  const sunDir = sun.target.position.clone().sub(sun.position).normalize();
  const toFloor = (p: THREE.Vector3) => p.clone().addScaledVector(sunDir, -p.y / sunDir.y);
  const shaftMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  for (const wz of WIN_Z) {
    const corners = [
      new THREE.Vector3(-10, WIN_LOW, wz - WIN_W / 2),
      new THREE.Vector3(-10, WIN_LOW, wz + WIN_W / 2),
      new THREE.Vector3(-10, WIN_HIGH, wz + WIN_W / 2),
      new THREE.Vector3(-10, WIN_HIGH, wz - WIN_W / 2),
    ];
    const far = corners.map(toFloor);
    const pos: number[] = [];
    const col: number[] = [];
    const quad = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3) => {
      for (const [p, k] of [
        [a, 1],
        [b, 1],
        [c, 0],
        [a, 1],
        [c, 0],
        [d, 0],
      ] as const) {
        pos.push(p.x, p.y, p.z);
        const v = k ? 0.06 : 0.0;
        col.push(v, v * 0.92, v * 0.75);
      }
    };
    for (let s = 0; s < 4; s++) quad(corners[s], corners[(s + 1) % 4], far[(s + 1) % 4], far[s]);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    scene.add(new THREE.Mesh(geo, shaftMat));
  }
  const dustCount = opts.reduced ? 120 : 420;
  const dustPos = new Float32Array(dustCount * 3);
  const r = rng(99);
  for (let i = 0; i < dustCount; i++) {
    dustPos[i * 3] = -9.5 + r() * 9;
    dustPos[i * 3 + 1] = r() * 6;
    dustPos[i * 3 + 2] = -7 + r() * 16;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0xfff1d0, size: 0.018, transparent: true, opacity: 0.55, depthWrite: false }));
  scene.add(dust);

  /* ---------------- provas na mesa ---------------- */
  const evidenceGroup = new THREE.Group();
  table.add(evidenceGroup);
  const items = new Map<string, { obj: THREE.Group; home: THREE.Vector3; mats: THREE.MeshStandardMaterial[] }>();
  const SLOTS = [
    [-0.55, -0.22],
    [-0.05, -0.25],
    [0.45, -0.2],
    [-0.55, 0.25],
    [-0.05, 0.22],
    [0.42, 0.26],
  ];

  const sheetTexture = (ev: EvidenceView, style: "print" | "email" | "documento" | "nota") => {
    const w = style === "nota" ? 256 : 512;
    const h = style === "nota" ? 640 : 724;
    const { c, x } = canvas(w, h);
    x.fillStyle = style === "nota" ? "#f7f3e6" : "#fbfaf6";
    x.fillRect(0, 0, w, h);
    x.fillStyle = "#1a1a1a";
    if (style === "print") {
      // Um print de navegador: barra de endereço, cabeçalho colorido e o texto.
      x.fillStyle = "#e3e5e8";
      x.fillRect(20, 20, w - 40, 46);
      x.fillStyle = "#ffffff";
      x.fillRect(80, 30, w - 140, 26);
      x.fillStyle = "#fa5c5c";
      x.fillRect(20, 76, w - 40, 120);
      x.fillStyle = "#ffffff";
      x.font = "bold 34px Arial";
      x.fillText(ev.title.slice(0, 22), 40, 150);
      x.fillStyle = "#222";
      x.font = "22px Arial";
      wrapText(x, ev.text, 34, 250, w - 68, 30, 14);
    } else if (style === "email") {
      x.font = "bold 22px Arial";
      x.fillText("De:  ••••••••@gmail.com", 34, 60);
      x.fillText(`Assunto: ${ev.title}`, 34, 94);
      x.fillStyle = "#c9c9c9";
      x.fillRect(34, 112, w - 68, 2);
      x.fillStyle = "#222";
      x.font = "24px Georgia";
      wrapText(x, ev.text, 34, 160, w - 68, 34, 14);
    } else if (style === "nota") {
      x.font = "bold 20px 'Courier New', monospace";
      x.textAlign = "center";
      x.fillText("**** COMPROVANTE ****", w / 2, 50);
      x.textAlign = "left";
      x.font = "16px 'Courier New', monospace";
      wrapText(x, ev.text, 18, 100, w - 36, 22, 20);
      for (let y = 480; y < 600; y += 6) {
        x.fillRect(30 + ((y * 7) % 40), y, 160 - ((y * 3) % 50), 3);
      }
    } else {
      x.font = "bold 30px Georgia";
      wrapText(x, ev.title.toUpperCase(), 40, 80, w - 80, 36, 2);
      x.fillRect(40, 130, w - 80, 3);
      x.font = "22px Georgia";
      wrapText(x, ev.text, 40, 180, w - 80, 32, 14);
      x.font = "italic 26px Georgia";
      x.fillText("__________________", 40, h - 90);
    }
    return tex(c);
  };
  const screenTexture = (ev: EvidenceView, phone: boolean) => {
    const w = phone ? 256 : 512;
    const h = phone ? 512 : 320;
    const { c, x } = canvas(w, h);
    x.fillStyle = phone ? "#111418" : "#0f1720";
    x.fillRect(0, 0, w, h);
    x.font = phone ? "14px Arial" : "15px 'Courier New', monospace";
    if (phone) {
      x.fillStyle = "#5865f2";
      x.fillRect(0, 0, w, 40);
      x.fillStyle = "#fff";
      x.font = "bold 16px Arial";
      x.fillText(ev.title.slice(0, 24), 12, 26);
      x.fillStyle = "#2b2f36";
      x.fillRect(12, 70, w - 40, 170);
      x.fillStyle = "#e6e6e6";
      x.font = "15px Arial";
      wrapText(x, ev.text, 22, 96, w - 60, 20, 8);
    } else {
      x.fillStyle = "#7ee787";
      for (let i = 0; i < 12; i++) x.fillText(`${(0x3a9f1 * (i + 7)).toString(16).slice(0, 7)}  ${["fix", "feat", "art", "build"][i % 4]}: ${ev.title.slice(0, 18)}`, 16, 28 + i * 22);
      x.fillStyle = "#c9d1d9";
      wrapText(x, ev.text, 16, 300 - 40, w - 32, 18, 2);
    }
    return tex(c);
  };

  const buildEvidence = (ev: EvidenceView) => {
    const g = new THREE.Group();
    const mats: THREE.MeshStandardMaterial[] = [];
    const own = (m: THREE.MeshStandardMaterial) => {
      mats.push(m);
      return m;
    };
    if (ev.kind === "notebook") {
      const shell = own(new THREE.MeshStandardMaterial({ color: 0x9aa0a6, metalness: 0.9, roughness: 0.35 }));
      rbox(0.34, 0.018, 0.24, 0.008, shell, 0, 0.009, 0, g);
      const lid = new THREE.Group();
      rbox(0.34, 0.012, 0.24, 0.006, shell, 0, 0, -0.12, lid);
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.31, 0.2), own(new THREE.MeshStandardMaterial({ map: screenTexture(ev, false), emissive: 0xffffff, emissiveMap: screenTexture(ev, false), emissiveIntensity: 0.8 })));
      // A tampa nasce aberta a 180° (deitada para trás); 70° para cima deixa a tela a uns 110°.
      scr.rotation.x = -Math.PI / 2;
      scr.position.set(0, 0.0068, -0.12);
      lid.add(scr);
      lid.position.set(0, 0.018, -0.12);
      lid.rotation.x = 1.22;
      g.add(lid);
      box(0.3, 0.002, 0.12, blackPlastic, 0, 0.019, -0.03, g);
    } else if (ev.kind === "celular") {
      rbox(0.08, 0.01, 0.16, 0.006, own(new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.2, metalness: 0.4 })), 0, 0.005, 0, g);
      const scrTex = screenTexture(ev, true);
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.072, 0.15), own(new THREE.MeshStandardMaterial({ map: scrTex, emissive: 0xffffff, emissiveMap: scrTex, emissiveIntensity: 0.9, roughness: 0.15 })));
      scr.rotation.x = -Math.PI / 2;
      scr.position.y = 0.0105;
      g.add(scr);
    } else {
      const style = ev.kind === "print" ? "print" : ev.kind === "email" ? "email" : ev.kind === "nota" ? "nota" : "documento";
      const w = style === "nota" ? 0.08 : 0.21;
      const h = style === "nota" ? 0.2 : 0.297;
      const front = own(new THREE.MeshStandardMaterial({ map: sheetTexture(ev, style), roughness: style === "print" ? 0.35 : 0.85 }));
      const sheets = style === "documento" ? 3 : 1;
      for (let s = 0; s < sheets; s++) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.0015, h), [paper, paper, s === sheets - 1 ? front : paper, paper, paper, paper]);
        m.position.set(s * 0.004, 0.001 + s * 0.0016, s * -0.003);
        m.rotation.y = (s - 1) * 0.02;
        add(m, g);
      }
      if (style === "documento") box(0.03, 0.004, 0.004, steel, -0.07, 0.008, -0.14, g);
    }
    g.traverse((o) => {
      o.userData.evidence = ev.id;
    });
    return { obj: g, mats };
  };

  /* ---------------- câmera ---------------- */
  const STATIONS: Record<Station, { pos: THREE.Vector3; look: THREE.Vector3; fov: number }> = {
    intro: { pos: new THREE.Vector3(0, 2.0, 4.2), look: new THREE.Vector3(0, 2.0, -6.5), fov: 46 },
    // Olha um pouco à direita da mesa: o painel das provas cobre o lado direito da cena.
    mesa: { pos: new THREE.Vector3(TABLE.x + 0.15, 1.6, TABLE.z + 1.15), look: new THREE.Vector3(TABLE.x + 0.4, 0.72, TABLE.z - 0.1), fov: 55 },
    tribuna: { pos: new THREE.Vector3(0, 1.66, LECTERN.z + 0.75), look: new THREE.Vector3(0, HEAD_Y - 0.9, JUDGE_Z), fov: 50 },
  };
  const anglesTo = (from: THREE.Vector3, to: THREE.Vector3) => {
    const d = to.clone().sub(from);
    return { yaw: Math.atan2(-d.x, -d.z), pitch: Math.atan2(d.y, Math.hypot(d.x, d.z)) };
  };
  const cam = {
    pos: STATIONS.intro.pos.clone(),
    base: anglesTo(STATIONS.intro.pos, STATIONS.intro.look),
    off: { yaw: 0, pitch: 0 },
    cur: { yaw: 0, pitch: 0 },
    fov: 48,
    fovCur: 48,
  };
  cam.cur = { ...cam.base };
  let station: Station = "intro";
  let walk: { from: THREE.Vector3; to: THREE.Vector3; t: number; dur: number; done: () => void; steps: number } | null = null;

  /* ---------------- interação: arrastar olha, clicar pega ---------------- */
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let hover: string | null = null;
  let drag: { x: number; y: number; moved: boolean; id: number } | null = null;
  const pickAt = (cx: number, cy: number): string | null => {
    const rect = cnv.getBoundingClientRect();
    ndc.set(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(evidenceGroup.children, true)[0];
    return (hit?.object.userData.evidence as string | undefined) ?? null;
  };
  const setHover = (id: string | null) => {
    if (id === hover) return;
    hover = id;
    for (const [key, it] of items) for (const m of it.mats) m.emissive.setHex(key === id && !m.emissiveMap ? 0x3a2a10 : m.emissiveMap ? 0xffffff : 0x000000);
    cnv.style.cursor = id ? "pointer" : "grab";
    opts.onHover(id);
  };
  const onDown = (e: PointerEvent) => {
    drag = { x: e.clientX, y: e.clientY, moved: false, id: e.pointerId };
    cnv.setPointerCapture(e.pointerId);
  };
  const onMove = (e: PointerEvent) => {
    if (drag && drag.id === e.pointerId) {
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
      if (drag.moved) {
        cam.off.yaw = THREE.MathUtils.clamp(cam.off.yaw + dx * 0.004, -1.35, 1.35);
        cam.off.pitch = THREE.MathUtils.clamp(cam.off.pitch + dy * 0.003, -0.6, 0.6);
        drag.x = e.clientX;
        drag.y = e.clientY;
      }
      return;
    }
    if (station === "mesa" && e.pointerType === "mouse") setHover(pickAt(e.clientX, e.clientY));
  };
  const onUp = (e: PointerEvent) => {
    if (!drag || drag.id !== e.pointerId) return;
    const click = !drag.moved;
    drag = null;
    if (click && station === "mesa" && !walk) {
      const id = pickAt(e.clientX, e.clientY);
      if (id) opts.onPick(id);
    }
  };
  cnv.addEventListener("pointerdown", onDown);
  cnv.addEventListener("pointermove", onMove);
  cnv.addEventListener("pointerup", onUp);
  cnv.addEventListener("pointercancel", onUp);
  cnv.style.cursor = "grab";

  /* ---------------- estado dos juízes ---------------- */
  const lean = opts.names.map(() => -0.3);
  const leanShown = lean.slice();
  let speaking: number | null = null;
  let focus: number | null = null;
  const leanColor = (v: number) => {
    const red = new THREE.Color(0xff2a1f);
    const amber = new THREE.Color(0xffa800);
    const green = new THREE.Color(0x52ff6a);
    const t = THREE.MathUtils.clamp(v / 0.6, -1, 1);
    return t < 0 ? amber.clone().lerp(red, -t) : amber.clone().lerp(green, t);
  };

  /* ---------------- laço ---------------- */
  let visible = true;
  const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
  io.observe(cnv);
  const clockT = new THREE.Clock();
  const tmp = new THREE.Vector3();
  const pickedIds = new Set<string>();

  const resize = () => {
    const w = cnv.clientWidth || 960;
    const h = cnv.clientHeight || 540;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();

  renderer.setAnimationLoop(() => {
    const dt = Math.min(0.05, clockT.getDelta());
    if (!visible) return;
    const t = clockT.elapsedTime;

    // Andar até outro lugar: passos com um leve balanço da cabeça.
    let bob = 0;
    if (walk) {
      walk.t = Math.min(1, walk.t + dt / walk.dur);
      const k = walk.t < 0.5 ? 2 * walk.t * walk.t : 1 - (-2 * walk.t + 2) ** 2 / 2;
      cam.pos.lerpVectors(walk.from, walk.to, k);
      const stepsNow = Math.floor(walk.t * walk.dur * 1.9);
      if (stepsNow > walk.steps) {
        walk.steps = stepsNow;
        if (walk.t < 0.95) opts.onStep();
      }
      bob = opts.reduced ? 0 : Math.sin(walk.t * walk.dur * 1.9 * Math.PI) * 0.025;
      if (walk.t >= 1) {
        const done = walk.done;
        walk = null;
        done();
      }
    } else if (station === "intro" && !opts.reduced) {
      cam.pos.x = Math.sin(t * 0.12) * 1.2;
    }

    // Olhar: base do lugar (ou o juiz em foco) mais o que a pessoa arrastou.
    let base = cam.base;
    if (focus !== null) {
      const j = judges[focus];
      // Mira abaixo da cabeça: o juiz fica no terço de cima, acima das legendas.
      base = anglesTo(cam.pos, tmp.set(j.root.position.x, HEAD_Y - 0.75, JUDGE_Z));
      cam.fov = 34;
    } else cam.fov = STATIONS[station].fov;
    if (!drag) {
      cam.off.yaw *= 1 - Math.min(1, dt * (focus !== null ? 1.5 : 0.15));
      cam.off.pitch *= 1 - Math.min(1, dt * (focus !== null ? 1.5 : 0.15));
    }
    const ease = Math.min(1, dt * 3.2);
    cam.cur.yaw += (base.yaw + cam.off.yaw - cam.cur.yaw) * ease;
    cam.cur.pitch += (base.pitch - cam.off.pitch - cam.cur.pitch) * ease;
    cam.fovCur += (cam.fov - cam.fovCur) * Math.min(1, dt * 2.2);
    camera.fov = cam.fovCur * (camera.aspect < 1.2 ? 1.25 : 1);
    camera.updateProjectionMatrix();
    camera.position.set(cam.pos.x, cam.pos.y + bob, cam.pos.z);
    camera.rotation.set(cam.cur.pitch, cam.cur.yaw, 0);

    // Juízes: respiram, olham para você, o visor segue o voto, quem fala brilha.
    for (const [i, j] of judges.entries()) {
      leanShown[i] += (lean[i] - leanShown[i]) * Math.min(1, dt * 2);
      j.torso.scale.y = 1 + Math.sin(t * 1.3 + i) * 0.008;
      const d = camera.position.clone().sub(tmp.set(j.root.position.x, HEAD_Y, JUDGE_Z));
      const yaw = THREE.MathUtils.clamp(Math.atan2(d.x, d.z), -0.7, 0.7) + Math.sin(t * 0.4 + i * 2) * 0.05;
      j.head.rotation.y += (yaw - j.head.rotation.y) * Math.min(1, dt * 2);
      j.head.rotation.x = Math.sin(t * 0.7 + i) * 0.03 - (speaking === i ? Math.sin(t * 9) * 0.015 : 0);
      j.eye.emissive.copy(leanColor(leanShown[i]));
      j.eye.emissiveIntensity = speaking === i ? 2.6 + Math.sin(t * 14) * 1.2 : 2.2;
      j.mic.emissive.setHex(speaking === i ? 0xff2020 : 0x000000);
    }
    talkSpot.intensity += ((speaking !== null ? 140 : 0) - talkSpot.intensity) * Math.min(1, dt * 4);
    if (speaking !== null) {
      talkSpot.position.set(judges[speaking].root.position.x, 6.8, -4.3);
      talkSpot.target.position.set(judges[speaking].root.position.x, HEAD_Y - 0.3, JUDGE_Z);
    }

    // Provas: as escolhidas deslizam para a pasta; a que está sob o mouse se ergue.
    let carried = 0;
    for (const [id, it] of items) {
      const picked = pickedIds.has(id);
      const target = picked ? tmp.set(0.82, 0.055 + carried++ * 0.012, 0.2) : it.home;
      it.obj.position.lerp(target, Math.min(1, dt * 6));
      const lift = hover === id && !picked ? 0.03 : 0;
      it.obj.position.y += (target.y + lift - it.obj.position.y) * Math.min(1, dt * 8);
      it.obj.rotation.y += ((picked ? 0.1 : (it.home.x * 0.5)) - it.obj.rotation.y) * Math.min(1, dt * 6);
    }

    // Poeira.
    const p = dust.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < dustCount; i++) {
      p.setY(i, (p.getY(i) + dt * 0.03 * (0.5 + (i % 5) * 0.2)) % 6);
      p.setX(i, p.getX(i) + Math.sin(t * 0.3 + i) * dt * 0.02);
    }
    p.needsUpdate = true;

    renderer.render(scene, camera);
  });

  return {
    setEvidence(list) {
      for (const it of items.values()) evidenceGroup.remove(it.obj);
      items.clear();
      list.forEach((ev, i) => {
        const { obj, mats } = buildEvidence(ev);
        const [sx, sz] = SLOTS[i % SLOTS.length];
        const home = new THREE.Vector3(sx, 0.035, sz);
        obj.position.copy(home);
        obj.rotation.y = sx * 0.5;
        evidenceGroup.add(obj);
        obj.traverse((o) => {
          if (o instanceof THREE.Mesh) {
            o.castShadow = true;
            o.receiveShadow = true;
          }
        });
        items.set(ev.id, { obj, home, mats });
      });
    },
    setPicked(ids) {
      pickedIds.clear();
      for (const id of ids) pickedIds.add(id);
    },
    goTo(next, walking = true) {
      return new Promise<void>((resolve) => {
        const to = STATIONS[next].pos.clone();
        station = next;
        cam.base = anglesTo(to, STATIONS[next].look);
        cam.off = { yaw: 0, pitch: 0 };
        setHover(null);
        if (!walking || opts.reduced) {
          cam.pos.copy(to);
          cam.cur = { ...cam.base };
          resolve();
          return;
        }
        const dur = Math.max(1.2, cam.pos.distanceTo(to) / 1.4);
        walk = { from: cam.pos.clone(), to, t: 0, dur, done: resolve, steps: 0 };
      });
    },
    focusJudge(i) {
      focus = i;
    },
    setSpeaking(i) {
      speaking = i;
    },
    setLean(values) {
      values.forEach((v, i) => (lean[i] = v));
    },
    setVotes(votes) {
      votes.forEach((v, i) => {
        const m = voteLamps[i];
        if (v === null) {
          m.emissive.setHex(0x000000);
          m.color.setHex(0x222222);
        } else {
          m.color.setHex(v ? 0x1f7a2a : 0x7a1f1f);
          m.emissive.setHex(v ? 0x40ff60 : 0xff2a20);
          m.emissiveIntensity = 2.2;
        }
      });
    },
    nudge(yaw, pitch) {
      cam.off.yaw = THREE.MathUtils.clamp(cam.off.yaw + yaw, -1.35, 1.35);
      cam.off.pitch = THREE.MathUtils.clamp(cam.off.pitch + pitch, -0.6, 0.6);
    },
    resize,
    dispose() {
      renderer.setAnimationLoop(null);
      window.clearInterval(clockTimer);
      io.disconnect();
      cnv.removeEventListener("pointerdown", onDown);
      cnv.removeEventListener("pointermove", onMove);
      cnv.removeEventListener("pointerup", onUp);
      cnv.removeEventListener("pointercancel", onUp);
      const seen = new Set<unknown>();
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.Points) {
          o.geometry.dispose();
          for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
            if (seen.has(m)) continue;
            seen.add(m);
            for (const v of Object.values(m)) if (v instanceof THREE.Texture) v.dispose();
            m.dispose();
          }
        }
      });
      env.dispose();
      pmrem.dispose();
      renderer.dispose();
    },
  };
}
