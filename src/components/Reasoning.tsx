/** Fundamentação de uma decisão da moderação, com a origem dita às claras. */
export function Reasoning({ text }: { text: string | null | undefined }) {
  if (!text) return null;
  return (
    <blockquote className="reasoning">
      <p>{text}</p>
      <footer>Fundamentação escrita pelo relator (um modelo de IA) depois do voto dos juízes.</footer>
    </blockquote>
  );
}
