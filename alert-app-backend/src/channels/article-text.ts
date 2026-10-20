// Helpers for showing an article in a message, shared by the channels (email, Slack).

/** Long descriptions (some are thousands of characters) are cut to about this length. */
export const DESCRIPTION_MAX_LENGTH = 300;

/** Cuts at the last space before the limit, so no word is cut in half. */
export function shortenDescription(text: string): string {
  if (text.length <= DESCRIPTION_MAX_LENGTH) return text;
  const cut = text.slice(0, DESCRIPTION_MAX_LENGTH);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/** Only web links become clickable (a provider could send e.g. a "javascript:" link). */
export function isWebLink(url: string): boolean {
  return /^https?:\/\//i.test(url);
}
