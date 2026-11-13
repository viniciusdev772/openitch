import "@/styles/estante.css";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BoxHead } from "@/components/auth/BoxOffice";
import { FirstUse } from "@/components/library/FirstUse";
import { Shelf } from "@/components/library/Shelf";
import { getSession } from "@/lib/auth/session";
import { readShelf } from "@/lib/library/rules";
import { getCatalog } from "@/lib/catalog/server";
import { programmeCreators, shelfData } from "@/lib/library/shelf";

export const metadata: Metadata = { title: "Sua estante", robots: { index: false } };

export default async function EstantePage() {
  const session = await getSession();
  if (!session) redirect("/entrar?de=/estante");
  const [{ saves, follows }, cat] = await Promise.all([readShelf(session.user._id), getCatalog()]);
  return (
    <>
      <BoxHead title="Sua estante">
        <p>Os jogos que você guardou para depois e quem você acompanha. Só você vê esta página.</p>
      </BoxHead>
      {saves.length === 0 && follows.length === 0 ? (
        <FirstUse creators={programmeCreators(cat)} />
      ) : (
        <Shelf data={shelfData(cat, saves, follows)} />
      )}
    </>
  );
}
