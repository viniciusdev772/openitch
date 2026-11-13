// Carregador mínimo para rodar os testes com o Node puro (sem bibliotecas):
//   node --experimental-strip-types --import ./src/lib/builds/__tests__/register.mjs --test src/lib/builds/__tests__/*.test.ts
// Resolve "@/..." para src/ e importações relativas sem extensão para .ts.
import { register } from "node:module";
register(new URL("./hooks.mjs", import.meta.url));
