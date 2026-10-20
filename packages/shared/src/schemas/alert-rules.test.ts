import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import {
  ALERT_RULE_NAME_MAX_LENGTH,
  KEYWORD_MAX_LENGTH,
  KEYWORDS_MAX,
} from '../constants/alert-rules.js';
import { CHANNELS_PER_RULE_MAX } from '../constants/channels.js';
import { validationMessagesEn } from '../i18n/validation.en.js';
import {
  alertRuleFormSchema,
  alertRuleSchema,
  createAlertRuleRequestSchema,
  updateAlertRuleRequestSchema,
} from './alert-rules.js';

const channelIds = ['channel-1'];
const keywordRule = {
  type: 'keywords',
  name: 'EV news',
  keywords: ['electric car', 'Tesla'],
  channelIds,
};
const categoryRule = { type: 'category', name: 'Sports', category: 'sports', channelIds };

/** Every key the tests below produce. Checked against the texts at the end. */
const producedKeys = new Set<string>();

/** Error keys per field, e.g. { keywords: ['keywords.tooMany'] }. */
function errorKeys(schema: z.ZodType, input: unknown): Record<string, string[]> {
  const result = schema.safeParse(input);
  if (result.success) return {};
  const keys: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    const field = issue.path.join('.');
    keys[field] = [...(keys[field] ?? []), issue.message];
    producedKeys.add(issue.message);
  }
  return keys;
}

const createErrors = (input: unknown) => errorKeys(createAlertRuleRequestSchema, input);
const updateErrors = (input: unknown) => errorKeys(updateAlertRuleRequestSchema, input);

describe('alertRuleSchema', () => {
  const rule = {
    id: 'rule-1',
    name: 'Sports',
    type: 'category',
    keywords: [],
    category: 'sports',
    enabled: true,
    channelIds,
    createdAt: '2026-10-20T08:00:00.000Z',
    updatedAt: '2026-10-20T08:00:00.000Z',
  };

  it('has lastAlertAt: a date, or null when the rule never sent an alert', () => {
    expect(alertRuleSchema.safeParse({ ...rule, lastAlertAt: null }).success).toBe(true);
    expect(
      alertRuleSchema.safeParse({ ...rule, lastAlertAt: '2026-10-20T10:00:00.000Z' }).success,
    ).toBe(true);
    expect(alertRuleSchema.safeParse(rule).success).toBe(false);
  });
});

describe('createAlertRuleRequestSchema', () => {
  it('accepts a keyword rule: trims, keeps phrases, drops the other type’s field', () => {
    expect(
      createAlertRuleRequestSchema.parse({
        ...keywordRule,
        name: '  EV news ',
        keywords: [' electric car ', 'Tesla'],
        category: 'world',
      }),
    ).toEqual({
      type: 'keywords',
      name: 'EV news',
      keywords: ['electric car', 'Tesla'],
      channelIds,
    });
  });

  it('accepts a category rule and drops keywords', () => {
    expect(createAlertRuleRequestSchema.parse({ ...categoryRule, keywords: ['x'] })).toEqual(
      categoryRule,
    );
  });

  it('keeps enabled when it is sent', () => {
    expect(createAlertRuleRequestSchema.parse({ ...categoryRule, enabled: false })).toMatchObject({
      enabled: false,
    });
  });

  it('needs a known type', () => {
    expect(createErrors({ name: 'x' })).toEqual({ type: ['alertRuleType.required'] });
    expect(createErrors({ ...categoryRule, type: 'both' })).toEqual({
      type: ['alertRuleType.required'],
    });
  });

  it('checks the name', () => {
    expect(createErrors({ ...categoryRule, name: '   ' })).toEqual({
      name: ['alertRuleName.required'],
    });
    expect(
      createErrors({ ...categoryRule, name: 'a'.repeat(ALERT_RULE_NAME_MAX_LENGTH + 1) }),
    ).toEqual({ name: ['alertRuleName.tooLong'] });
    expect(createErrors({ type: 'category', category: 'sports', channelIds })).toEqual({
      name: ['alertRuleName.required'],
    });
  });

  it('checks the keywords, reporting single-keyword errors on the keywords field', () => {
    const keywordErrors = (keywords: unknown) => createErrors({ ...keywordRule, keywords });

    expect(keywordErrors(undefined)).toEqual({ keywords: ['keywords.required'] });
    expect(keywordErrors([])).toEqual({ keywords: ['keywords.required'] });
    expect(
      keywordErrors(Array.from({ length: KEYWORDS_MAX + 1 }, (_, i) => `keyword ${i}`)),
    ).toEqual({ keywords: ['keywords.tooMany'] });
    expect(keywordErrors(['ok', ' a '])).toEqual({ keywords: ['keyword.tooShort'] });
    expect(keywordErrors(['ok', 'a'.repeat(KEYWORD_MAX_LENGTH + 1)])).toEqual({
      keywords: ['keyword.tooLong'],
    });
    expect(keywordErrors(['Tesla', ' tesla '])).toEqual({ keywords: ['keywords.duplicate'] });
  });

  it('accepts exactly the limits', () => {
    const keywords = Array.from({ length: KEYWORDS_MAX }, (_, i) => `k${i}`);
    expect(createErrors({ ...keywordRule, keywords })).toEqual({});
    expect(createErrors({ ...keywordRule, keywords: ['a'.repeat(KEYWORD_MAX_LENGTH)] })).toEqual(
      {},
    );
  });

  it('checks the channels', () => {
    const channelErrors = (channelIds: unknown) => createErrors({ ...categoryRule, channelIds });

    expect(channelErrors(undefined)).toEqual({ channelIds: ['channelIds.required'] });
    expect(channelErrors([])).toEqual({ channelIds: ['channelIds.required'] });
    expect(
      channelErrors(Array.from({ length: CHANNELS_PER_RULE_MAX + 1 }, (_, i) => `channel-${i}`)),
    ).toEqual({ channelIds: ['channelIds.tooMany'] });
    expect(channelErrors(['a', 'a'])).toEqual({ channelIds: ['channelIds.duplicate'] });
    expect(
      channelErrors(Array.from({ length: CHANNELS_PER_RULE_MAX }, (_, i) => `channel-${i}`)),
    ).toEqual({});
  });

  it('only accepts our categories', () => {
    expect(createErrors({ ...categoryRule, category: 'top' })).toEqual({
      category: ['category.required'],
    });
    expect(createErrors({ type: 'category', name: 'x', channelIds })).toEqual({
      category: ['category.required'],
    });
    expect(createErrors({ ...categoryRule, category: 'other' })).toEqual({});
  });
});

describe('updateAlertRuleRequestSchema', () => {
  it('accepts only some fields, e.g. the on/off switch', () => {
    expect(updateAlertRuleRequestSchema.parse({ enabled: false })).toEqual({ enabled: false });
    expect(updateAlertRuleRequestSchema.parse({})).toEqual({});
  });

  it('accepts a type with its field', () => {
    expect(updateErrors({ type: 'category', category: 'health' })).toEqual({});
    expect(updateErrors({ type: 'keywords', keywords: ['flood'] })).toEqual({});
  });

  it('needs the field of the type that is sent', () => {
    expect(updateErrors({ type: 'keywords' })).toEqual({ keywords: ['keywords.required'] });
    expect(updateErrors({ type: 'category' })).toEqual({ category: ['category.required'] });
  });

  it('rejects keywords or a category without a type', () => {
    expect(updateErrors({ keywords: ['flood'] })).toEqual({ type: ['alertRuleType.required'] });
    expect(updateErrors({ category: 'health' })).toEqual({ type: ['alertRuleType.required'] });
  });

  it('replaces the channels only when they are sent', () => {
    expect(updateAlertRuleRequestSchema.parse({ channelIds })).toEqual({ channelIds });
    expect(updateErrors({ channelIds: [] })).toEqual({ channelIds: ['channelIds.required'] });
  });

  it('checks the fields like the create schema', () => {
    expect(updateErrors({ name: '' })).toEqual({ name: ['alertRuleName.required'] });
    expect(updateErrors({ type: 'keywords', keywords: ['a', 'b'] })).toEqual({
      keywords: ['keyword.tooShort'],
    });
  });
});

describe('alertRuleFormSchema', () => {
  const form = { name: 'EV news', type: 'keywords', keywords: ['Tesla'], category: '', channelIds };

  it('returns the request body of the selected type only', () => {
    expect(alertRuleFormSchema.parse(form)).toEqual({
      name: 'EV news',
      type: 'keywords',
      keywords: ['Tesla'],
      channelIds,
    });
    expect(alertRuleFormSchema.parse({ ...form, type: 'category', category: 'science' })).toEqual({
      name: 'EV news',
      type: 'category',
      category: 'science',
      channelIds,
    });
  });

  it('only checks the field of the selected type', () => {
    // Empty keywords don't matter for a category rule, and the reverse
    expect(errorKeys(alertRuleFormSchema, { ...form, keywords: [], type: 'category' })).toEqual({
      category: ['category.required'],
    });
    expect(errorKeys(alertRuleFormSchema, { ...form, keywords: [] })).toEqual({
      keywords: ['keywords.required'],
    });
  });
});

describe('validation texts', () => {
  it('has exactly one text for every alert rule error key', () => {
    const groups = [
      'alertRuleName',
      'alertRuleType',
      'keywords',
      'keyword',
      'category',
      'channelIds',
    ] as const;
    const textKeys = groups.flatMap((group) =>
      Object.keys(validationMessagesEn[group]).map((key) => `${group}.${key}`),
    );

    expect([...producedKeys].sort()).toEqual(textKeys.sort());
  });
});
