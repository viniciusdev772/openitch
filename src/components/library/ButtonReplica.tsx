import { LIBRARY_COPY, type LibraryKind } from "./copy";

/** Cópia inerte do botão, para mostrar onde ele fica em vez de descrevê-lo. */
export function ButtonReplica({ kind }: { kind: LibraryKind }) {
  const copy = LIBRARY_COPY[kind];
  return (
    <span className="lib-replica">
      <copy.Off aria-hidden />
      {copy.off}
    </span>
  );
}
