// The rotating welcome on the buyer home.
//
// The point is recognition: someone in Padang or Makassar opens the app and
// sees their own language, not just Jakarta's. That only works if the words
// are RIGHT — greeting someone incorrectly in their own language is worse
// than not trying, and the brand's whole promise is "tidak pernah membuat
// malu".
//
// So each entry carries a `verified` flag. Only verified greetings rotate.
// Set `verified: true` once a native speaker has confirmed the wording —
// do not flip these on a hunch or a search result.

export type Greeting = {
  /** The greeting itself. */
  text: string;
  /** Language name, shown small under the greeting so the gesture lands. */
  language: string;
  /**
   * Confirmed by someone who speaks it. Unverified entries are kept here as
   * a to-do list but never shown.
   */
  verified: boolean;
};

export const GREETINGS: Greeting[] = [
  // — Confident —
  { text: 'Selamat datang', language: 'Indonesia', verified: true },
  { text: 'Wilujeng sumping', language: 'Sunda', verified: true },
  { text: 'Sugeng rawuh', language: 'Jawa', verified: true },
  { text: 'Salamaik datang', language: 'Minangkabau', verified: true },
  { text: 'Selamat datang', language: 'Melayu', verified: true },

  // — NOT yet confirmed by a speaker. These stay hidden until they are. —
  // Madura: "Salamet dhateng" is the form I have seen, but Madurese has
  // strong speech levels (èngghi-bhunten vs enja'-iya) and the polite
  // register matters for a greeting to a stranger.
  { text: 'Salamet dhateng', language: 'Madura', verified: false },
  // Bugis: "Tabe'" is a respectful address/"excuse me" rather than a literal
  // welcome. It may be the warmer choice, or it may read oddly here.
  { text: "Tabe'", language: 'Bugis', verified: false },
  // Papua and Maluku are Malay varieties; a distinct *written* greeting may
  // not exist, in which case they should simply be dropped rather than
  // padded with something invented.
  { text: 'Selamat datang', language: 'Papua', verified: false },
  { text: 'Selamat datang', language: 'Maluku', verified: false },
];

export const verifiedGreetings = (): Greeting[] => GREETINGS.filter((g) => g.verified);

/**
 * A rotation order that starts somewhere random, so the app does not always
 * open in the same language — but still cycles through every one rather than
 * picking at random each tick, which would repeat and skip.
 */
export function greetingRotation(): Greeting[] {
  const list = verifiedGreetings();
  if (list.length <= 1) return list;
  const start = Math.floor(Math.random() * list.length);
  return [...list.slice(start), ...list.slice(0, start)];
}
