/**
 * Signup usernames start with the chosen royal title: picking "King" puts "king-" in the username box and the
 * person types the rest ("king-abc123").
 */

/** Every title value is already URL-safe ("king", "your-majesty"); a chosen title starts the username: "king-". */
export function titlePrefix(title: string): string {
  return title ? `${title}-` : '';
}

/** Removes a leading title prefix (the longest matching one) so a different title can replace it. */
export function stripTitlePrefix(name: string, titles: readonly string[]): string {
  const match = [...titles].sort((a, b) => b.length - a.length).find((t) => name.startsWith(`${t}-`));
  return match ? name.slice(match.length + 1) : name;
}

/** The username with the chosen title's prefix kept in front of whatever the user typed after it. */
export function withTitlePrefix(name: string, title: string, titles: readonly string[]): string {
  const rest = stripTitlePrefix(name, titles).replace(/^-+/, '');
  return `${titlePrefix(title)}${rest}`;
}

/**
 * What the username box holds after a keystroke while a title is chosen. Backspacing into the prefix ("king-" →
 * "king") snaps back to "king-" instead of producing "king-king"; anything else keeps the prefix in front.
 */
export function typedUsername(typed: string, title: string, titles: readonly string[]): string {
  if (!title) return typed;
  const prefix = titlePrefix(title);
  if (prefix.startsWith(typed)) return prefix;
  return withTitlePrefix(typed, title, titles);
}
