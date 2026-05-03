const BAD_WORDS = [
  "fuck", "shit", "bitch", "cunt", "dick", "cock", "ass", "asshole",
  "bastard", "damn", "hell", "piss", "whore", "slut", "nigger", "fag",
  "orospu", "sik", "sikim", "siktir", "göt", "götü", "piç", "salak",
  "aptal", "gerizekalı", "amk", "bok", "yarrak", "yarak", "oç",
  "gavat", "kaltak", "ibne", "pezevenk", "orosbuçuk", "amına", "götveren",
  "kahpe", "sürtük", "haysiyetsiz", "şerefsiz", "namussuz",
];

const PATTERN = new RegExp(
  BAD_WORDS.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"),
  "gi"
);

export function filterBadWords(text: string): string {
  return text.replace(PATTERN, (match) => "*".repeat(match.length));
}

export function hasBadWords(text: string): boolean {
  return PATTERN.test(text);
}
