// Endereços legíveis, puros e sem dependências: usados pelas etiquetas e pelos
// rascunhos (e por componentes de cliente, sem puxar dados para o bundle).

/** Minúsculas, sem acento: "Física" e "fisica" viram a mesma chave. */
export const fold = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/**
 * Slug de um texto: dobrado, cada sequência do que não é a-z ou 0-9 vira um
 * hífen, sem hífen nas pontas. "Um botão!" -> "um-botao". Com `max`, corta no
 * tamanho e tira o hífen que sobrar no fim. O resultado só tem [a-z0-9-], então
 * é seguro num caminho.
 */
export function slugify(text: string, max?: number): string {
  const s = fold(text)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return max === undefined ? s : s.slice(0, max).replace(/-+$/g, "");
}
