import { DraftList } from "@/components/projetos/DraftList";
export const dynamic = "force-dynamic";
export default function Page() {
  return (
    <DraftList
      max={10}
      jamTitles={{}}
      openJams={[]}
      drafts={[{ id: "6b00c9741c31425cbc03ee46", title: "DeepSong", tagline: "x", track: "acao", jam: null, updatedAt: new Date().toISOString(), state: "rascunho", publicSlug: null, moderated: { rule: "Só publique o que é seu", appeal: "pode" } }]}
    />
  );
}
