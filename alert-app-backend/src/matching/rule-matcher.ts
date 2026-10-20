// Decides whether an article matches an alert rule. Plain functions (no database, no Nest), so
// the rules are easy to test with many examples (rule-matcher.spec.ts).

/** The rule fields matching needs. */
export interface MatchableRule {
  type: 'keywords' | 'category';
  keywords: string[];
  category: string | null;
  createdAt: Date;
}

/** The article fields matching needs. */
export interface MatchableArticle {
  title: string;
  description: string | null;
  categories: string[];
  /** When we saved it */
  createdAt: Date;
}

// A letter or digit in any language. Around a keyword there must be something else (a space,
// punctuation, an apostrophe, a hyphen, the start or end of the text): "EV" ≠ "every", but
// "EV's", "(EV)" and "EV-maker" are fine. JavaScript's \b only knows English letters.
const WORD_CHAR = String.raw`[\p{L}\p{N}]`;
// Between the words of a phrase: spaces or hyphens ("electric car" = "electric-car"),
// also the Unicode hyphen (U+2010) and non-breaking hyphen (U+2011)
const PHRASE_GAP = String.raw`[\s\-\u2010\u2011]+`;

/** Lowercase, without accents ("Fiancée" → "fiancee"), so case and accents don't matter. */
function normalize(text: string): string {
  return text.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** A pattern for one keyword or phrase, in the exact form (no plurals: "car" ≠ "cars"). */
function keywordPattern(keyword: string): RegExp {
  const words = normalize(keyword).split(new RegExp(PHRASE_GAP, 'u')).filter(Boolean);
  const phrase = words.map(escapeRegExp).join(PHRASE_GAP);
  return new RegExp(`(?<!${WORD_CHAR})${phrase}(?!${WORD_CHAR})`, 'u');
}

/**
 * A test for one rule. The keyword patterns are built once, then used for every article of a
 * fetch. Matches when:
 * - the article was saved after the rule was created (a new rule doesn't get old news),
 * - keyword rules: every keyword is in the title or the description (each may be in either),
 * - category rules: the article has the rule's category.
 */
export function ruleMatcher(rule: MatchableRule): (article: MatchableArticle) => boolean {
  const isNewer = (article: MatchableArticle) => article.createdAt > rule.createdAt;

  if (rule.type === 'category') {
    const { category } = rule;
    return (article) =>
      isNewer(article) && category !== null && article.categories.includes(category);
  }

  const patterns = rule.keywords.map(keywordPattern);
  return (article) => {
    if (!isNewer(article) || patterns.length === 0) return false;
    // Title and description separately: a phrase must not run from the end of one into the other
    const texts = [article.title, article.description ?? ''].map(normalize);
    return patterns.every((pattern) => texts.some((text) => pattern.test(text)));
  };
}
