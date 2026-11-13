// Pure helpers for tag addresses and accent-blind matching. No catalogue
// import here, so client components (the catalogue, the entry card) can use
// it without pulling extra data into their bundle.

/** Lowercase, without accents: "Física" and "fisica" fold to the same key. */
export const fold = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/**
 * The URL slug of a tag: folded, every run of anything that is not a-z or 0-9
 * turned into one hyphen, no hyphen at the ends. "um botão" -> "um-botao".
 * The result only ever holds [a-z0-9-], so it is safe in a path.
 */
export function tagSlug(tag: string): string {
  return fold(tag)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Link to a tag's page, or null when the tag has no usable letters. */
export function tagHref(tag: string): string | null {
  const slug = tagSlug(tag);
  return slug ? `/etiqueta/${slug}` : null;
}
