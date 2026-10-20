import { addMinutes } from 'date-fns';
import { ruleMatcher, type MatchableArticle, type MatchableRule } from './rule-matcher.js';

const ruleCreatedAt = new Date('2026-10-20T08:00:00Z');

const keywordRule = (...keywords: string[]): MatchableRule => ({
  type: 'keywords',
  keywords,
  category: null,
  createdAt: ruleCreatedAt,
});

const categoryRule = (category: string): MatchableRule => ({
  type: 'category',
  keywords: [],
  category,
  createdAt: ruleCreatedAt,
});

const article = (changes: Partial<MatchableArticle> = {}): MatchableArticle => ({
  title: '',
  description: null,
  categories: ['other'],
  // Saved after the rule
  createdAt: addMinutes(ruleCreatedAt, 5),
  ...changes,
});

/** Does a keyword rule match an article with this title? */
const titleMatches = (keywords: string[], title: string) =>
  ruleMatcher(keywordRule(...keywords))(article({ title }));

describe('ruleMatcher: keywords', () => {
  it('ignores case and accents', () => {
    expect(titleMatches(['tesla'], 'TESLA sales are up')).toBe(true);
    expect(titleMatches(['fiancee'], 'RJ Mitte Fiancée’s Move to Georgia')).toBe(true);
    expect(titleMatches(['Fiancée'], 'his fiancee said')).toBe(true);
  });

  it('matches whole words only, in the exact form', () => {
    expect(titleMatches(['EV'], 'Every company')).toBe(false);
    expect(titleMatches(['car'], 'Electric cars are selling')).toBe(false);
    expect(titleMatches(['new'], 'Breaking news')).toBe(false);
    expect(titleMatches(['art'], 'A new start')).toBe(false);
  });

  it('accepts apostrophes, brackets, hyphens and punctuation around a word', () => {
    expect(titleMatches(['EV'], "The EV's battery")).toBe(true);
    expect(titleMatches(['Apple'], 'Apple’s $5 Trillion Market')).toBe(true);
    expect(titleMatches(['EV'], 'Electric vehicles (EV) are coming')).toBe(true);
    expect(titleMatches(['EV'], 'An EV-maker grows')).toBe(true);
    expect(titleMatches(['Tesla'], 'Tesla.')).toBe(true);
  });

  it('matches phrases with the words in order, with spaces or hyphens between them', () => {
    expect(titleMatches(['electric car'], 'A new Electric Car')).toBe(true);
    expect(titleMatches(['electric car'], 'electric  car')).toBe(true);
    expect(titleMatches(['electric car'], 'an electric-car maker')).toBe(true);
    // Non-breaking hyphen (U+2011), used by some sites
    expect(titleMatches(['electric car'], 'an electric\u2011car maker')).toBe(true);
    expect(titleMatches(['electric-car'], 'an electric car maker')).toBe(true);
    // Digits are part of words, not gaps
    expect(titleMatches(['electric car'], 'electric2car')).toBe(false);
    expect(titleMatches(['electric car'], 'a car that is electric')).toBe(false);
    expect(titleMatches(['electric car'], 'electric cars')).toBe(false);
  });

  it('handles keywords with special characters', () => {
    expect(titleMatches(['C++'], 'Why C++ is still popular')).toBe(true);
    expect(titleMatches(['AT&T'], 'AT&T raises prices')).toBe(true);
    expect(titleMatches(['U.S.'], 'The U.S. economy')).toBe(true);
    expect(titleMatches(['U.S.'], 'The USA economy')).toBe(false);
  });

  it('needs every keyword, each in the title or the description', () => {
    const matches = ruleMatcher(keywordRule('Tesla', 'battery'));

    expect(matches(article({ title: 'Tesla battery news' }))).toBe(true);
    expect(matches(article({ title: 'Tesla news', description: 'A new battery' }))).toBe(true);
    expect(matches(article({ title: 'Tesla news', description: 'Nothing else' }))).toBe(false);
    expect(matches(article({ title: 'Tesla news', description: null }))).toBe(false);
  });

  it('does not match a phrase from the end of the title into the description', () => {
    const matches = ruleMatcher(keywordRule('electric car'));

    expect(matches(article({ title: 'All electric', description: 'Car makers react' }))).toBe(
      false,
    );
  });

  it('matches nothing without keywords', () => {
    expect(titleMatches([], 'Anything')).toBe(false);
  });
});

describe('ruleMatcher: category', () => {
  it('matches articles that have the category', () => {
    const matches = ruleMatcher(categoryRule('sports'));

    expect(matches(article({ categories: ['sports'] }))).toBe(true);
    expect(matches(article({ categories: ['business', 'sports'] }))).toBe(true);
    expect(matches(article({ categories: ['business'] }))).toBe(false);
  });
});

describe('ruleMatcher: rule age', () => {
  it('only matches articles saved after the rule was created', () => {
    const keywords = ruleMatcher(keywordRule('Tesla'));
    const category = ruleMatcher(categoryRule('sports'));
    const older = { createdAt: addMinutes(ruleCreatedAt, -5) };

    expect(keywords(article({ title: 'Tesla', ...older }))).toBe(false);
    expect(category(article({ categories: ['sports'], ...older }))).toBe(false);
  });
});
