/** Up to two uppercase initials for avatars ("Braulio Ponce" -> "BP"). */
export function initials(value: string | null | undefined): string {
  const words = (value ?? '').trim().split(/[\s@._-]+/).filter(Boolean);
  if (words.length === 0) return '?';
  const letters = words.length === 1 ? words[0].slice(0, 2) : words[0][0] + words[1][0];
  return letters.toUpperCase();
}
