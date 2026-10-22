/**
 * Iniciales públicas de una reserva: primera letra del primer nombre y del
 * último apellido. Se calcula exclusivamente en el servidor.
 */
export function getInitials(fullName: string): string {
  const words = fullName
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0);

  if (words.length === 0) return "?";

  const firstWord = words[0];
  const lastWord = words[words.length - 1];
  const firstLetter = Array.from(firstWord)[0] ?? "?";
  const lastLetter = Array.from(lastWord)[0] ?? firstLetter;

  const format = (letter: string) => `${letter.toLocaleUpperCase("es-AR")}.`;

  if (words.length === 1) return format(firstLetter);
  return `${format(firstLetter)} ${format(lastLetter)}`;
}
