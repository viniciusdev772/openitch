import { fail, handle, json } from "@/lib/uploads/http";
import { installRuntime } from "@/lib/builds/exe-install";
import { exeLauncherUrl } from "@/lib/builds/exe-server";
import { install64, missing64, page64Url } from "@/lib/builds/exe64-install";

/** GET ?motor=64: o motor de 64 bits já está instalado? (sem conta: só consulta, nunca instala). */
export async function GET(req: Request) {
  if (new URL(req.url).searchParams.get("motor") !== "64") return fail(404, "nao_encontrado", "Nada aqui.");
  try {
    const pronto = (await missing64()).length === 0;
    return json(pronto ? { ok: true, estado: "pronto", launcher: page64Url() } : { ok: true, estado: "instalando", faltam: null });
  } catch (err) {
    console.error("[jogar-exe] motor 64", err);
    return fail(503, "servidor", "Não conseguimos consultar o motor de 64 bits agora.");
  }
}

export const dynamic = "force-dynamic";
// Na primeira vez baixa o emulador do GitHub e o grava no MinIO (o teto do plano Hobby é 300 s).
export const maxDuration = 300;

/**
 * POST /api/jogar-exe/instalar: instala o emulador de Windows no bucket jogável,
 * se faltar. { estado: "pronto", launcher } ou { estado: "instalando" } (outra
 * chamada já está instalando, ou ainda faltam arquivos: chame de novo).
 * ?motor=64: o motor de 64 bits (Boxedwine64), em vários pedidos ({ faltam }).
 */
export async function POST(req: Request) {
  const motor64 = new URL(req.url).searchParams.get("motor") === "64";
  return handle(
    req,
    async () => {
      if (motor64) {
        const r = await install64();
        return r.estado === "pronto" ? { estado: "pronto", launcher: page64Url() } : r;
      }
      const estado = await installRuntime();
      return estado === "pronto" ? { estado, launcher: await exeLauncherUrl() } : { estado };
    },
    { mutates: true },
  );
}
