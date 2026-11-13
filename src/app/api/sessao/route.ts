import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/** Quem está dentro, para o cabeçalho do site. Só o primeiro nome sai daqui. */
export async function GET() {
  let name: string | null = null;
  try {
    const s = await getSession();
    if (s) name = s.user.name.split(" ")[0] ?? s.user.name;
  } catch {
    name = null;
  }
  return Response.json(
    { name },
    { headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } },
  );
}
