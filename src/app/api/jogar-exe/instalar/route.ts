import { handle } from "@/lib/uploads/http";
import { installRuntime } from "@/lib/builds/exe-install";
import { exeLauncherUrl } from "@/lib/builds/exe-server";

export const dynamic = "force-dynamic";
// Na primeira vez baixa o Boxedwine do GitHub e o grava no MinIO (o teto do plano Hobby é 300 s).
export const maxDuration = 300;

/**
 * POST /api/jogar-exe/instalar: instala o emulador de Windows no bucket
 * jogável, se faltar. { estado: "pronto", launcher } ou { estado: "instalando" }
 * (outra chamada já está instalando: tente de novo em alguns segundos).
 */
export async function POST(req: Request) {
  return handle(
    req,
    async () => {
      const estado = await installRuntime();
      return estado === "pronto" ? { estado, launcher: await exeLauncherUrl() } : { estado };
    },
    { mutates: true },
  );
}
