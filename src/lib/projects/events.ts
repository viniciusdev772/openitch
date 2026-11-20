/** Evento de janela: a lista de arquivos ou builds de um rascunho mudou (o painel de publicar confere de novo). */
export const FILES_CHANGED = "vibegames:arquivos";

/** Evento de janela: um arquivo trazido do itch.io entrou na lista de downloads (a lista recarrega). */
export const ITCH_FILES = "portal:itch-arquivos";

/** Evento de janela (detail: plataforma): o itch.io trouxe um arquivo de uma plataforma que o formulário ainda não marcou. */
export const ITCH_PLATFORM = "portal:itch-plataforma";

/** Evento de janela: o zip da versão de navegador veio do itch.io e espera em takeItchWebZip(). */
export const ITCH_WEB = "portal:itch-web";

let pendingWebZip: File | null = null;

/** Entrega o zip de navegador ao painel de builds (que pode ainda nem estar na tela). */
export function handItchWebZip(file: File) {
  pendingWebZip = file;
  window.dispatchEvent(new Event(ITCH_WEB));
}

export function takeItchWebZip(): File | null {
  const f = pendingWebZip;
  pendingWebZip = null;
  return f;
}
