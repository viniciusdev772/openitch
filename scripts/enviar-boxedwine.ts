/*
 * Alternativa à instalação automática: envia o Boxedwine (emulador de Windows
 * em WebAssembly, GPL-2.0) ao bucket jogável a partir de qualquer máquina com
 * as variáveis S3_* do site, sem passar pela Vercel. Normalmente não é
 * preciso: o próprio site instala na primeira partida (POST /api/jogar-exe/instalar).
 *
 *   node --env-file=.env.local scripts/enviar-boxedwine.ts
 *
 * A lógica é a mesma do site (src/lib/builds/exe-install.ts, uploadRuntime),
 * sem a trava no Mongo. Código-fonte do Boxedwine: https://github.com/danoon2/Boxedwine/tree/26R1.0
 */
import { register } from "node:module";

// Resolve "@/..." como nos testes, e "server-only" (que só o Next conhece) vira um módulo vazio.
register(new URL("../src/lib/builds/__tests__/hooks.mjs", import.meta.url));
register(
  "data:text/javascript," +
    encodeURIComponent(
      `export async function resolve(s, c, next) { return s === "server-only" ? { url: "data:text/javascript,", shortCircuit: true } : next(s, c); }`,
    ),
);

const { uploadRuntime } = await import("../src/lib/builds/exe-install");
await uploadRuntime((line) => console.log(line));
console.log("Pronto: o Boxedwine está no bucket jogável.");
