import "@/styles/estante.css";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BoxHead } from "@/components/auth/BoxOffice";
import { Shelf } from "@/components/library/Shelf";
import { getSession } from "@/lib/auth/session";
import { readShelf } from "@/lib/library/rules";

export const metadata: Metadata = { title: "Sua estante", robots: { index: false } };

export default async function EstantePage() {
  const session = await getSession();
  if (!session) redirect("/entrar?de=/estante");
  const { saves, follows } = await readShelf(session.user._id);
  return (
    <>
      <BoxHead title="Sua estante">
        <p>Os jogos que você guardou para depois e quem você acompanha. Só você vê esta página.</p>
      </BoxHead>
      <Shelf saves={saves} follows={follows} />
    </>
  );
}
