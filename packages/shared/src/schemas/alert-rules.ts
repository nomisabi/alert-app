import { z } from 'zod';
import {
  ALERT_RULE_NAME_MAX_LENGTH,
  ALERT_RULE_TYPES,
  KEYWORD_MAX_LENGTH,
  KEYWORD_MIN_LENGTH,
  KEYWORDS_MAX,
} from '../constants/alert-rules.js';
import { APP_CATEGORIES } from '../constants/categories.js';
import { appCategorySchema } from './categories.js';
import { channelIdsSchema } from './channels.js';

/**
 * Alert rule rules shared by the frontend (form validation) and the backend (request validation).
 * Error messages are i18n keys of the `validation` namespace (see i18n/validation.en.ts).
 */

export const alertRuleTypeSchema = z.enum(ALERT_RULE_TYPES, 'alertRuleType.required');
export type AlertRuleType = z.infer<typeof alertRuleTypeSchema>;

export const alertRuleNameSchema = z
  .string('alertRuleName.required')
  .trim()
  .min(1, 'alertRuleName.required')
  .max(ALERT_RULE_NAME_MAX_LENGTH, 'alertRuleName.tooLong');

/**
 * 1–10 keywords (or phrases), all of which must appear in an article.
 * The rules for one keyword are checked on the whole list, so the error belongs to the
 * `keywords` field (one message under the keywords input), not to `keywords.3`.
 */
export const keywordsSchema = z
  .array(z.string('keywords.required').trim(), 'keywords.required')
  .superRefine((keywords, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: 'custom', message });

    if (keywords.length === 0) return fail('keywords.required');
    if (keywords.length > KEYWORDS_MAX) return fail('keywords.tooMany');
    if (keywords.some((keyword) => keyword.length < KEYWORD_MIN_LENGTH)) {
      return fail('keyword.tooShort');
    }
    if (keywords.some((keyword) => keyword.length > KEYWORD_MAX_LENGTH)) {
      return fail('keyword.tooLong');
    }
    const lowercased = keywords.map((keyword) => keyword.toLowerCase());
    if (new Set(lowercased).size !== lowercased.length) return fail('keywords.duplicate');
  });

/** Like appCategorySchema, but with a form error text. */
export const alertRuleCategorySchema = z.enum(APP_CATEGORIES, 'category.required');

/** One rule, as its owner sees it. Mirrors the database row. */
export const alertRuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: alertRuleTypeSchema,
  /** [] for category rules. */
  keywords: z.array(z.string()),
  /** null for keyword rules. */
  category: appCategorySchema.nullable(),
  /** Switched-off rules are kept but never matched. */
  enabled: z.boolean(),
  /** Where matches are sent (ids from GET /api/channels). */
  channelIds: z.array(z.string()),
  /**
   * When this rule last sent an alert, on any of its channels (ISO 8601). null = never.
   * Only sent messages count, not pending or failed ones. Read-only (not in the requests).
   */
  lastAlertAt: z.iso.datetime().nullable(),
  /** ISO 8601, e.g. 2026-10-19T20:46:42.000Z */
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type AlertRule = z.infer<typeof alertRuleSchema>;

/** Response of GET /api/alert-rules. Newest first, no pagination (max 20 per user). */
export const alertRuleListSchema = z.object({
  items: z.array(alertRuleSchema),
});
export type AlertRuleList = z.infer<typeof alertRuleListSchema>;

const alertRuleBaseSchema = z.object({
  name: alertRuleNameSchema,
  /** Default: true */
  enabled: z.boolean('invalid').optional(),
  channelIds: channelIdsSchema,
});

/**
 * Body of POST /api/alert-rules, also used by the create/edit form.
 * `type` decides which field is required: `keywords` or `category`. Other fields are dropped.
 */
export const createAlertRuleRequestSchema = z.discriminatedUnion(
  'type',
  [
    alertRuleBaseSchema.extend({ type: z.literal('keywords'), keywords: keywordsSchema }),
    alertRuleBaseSchema.extend({ type: z.literal('category'), category: alertRuleCategorySchema }),
  ],
  'alertRuleType.required',
);
export type CreateAlertRuleRequest = z.infer<typeof createAlertRuleRequestSchema>;

/**
 * Create/edit form. It keeps both `keywords` and `category`, so switching the type doesn't lose
 * what was typed. `.pipe()` then checks the values with the create schema, which only checks
 * (and returns) the field of the selected type. The output is the request body.
 */
export const alertRuleFormSchema = z
  .object({
    name: z.string(),
    type: alertRuleTypeSchema,
    keywords: z.array(z.string()),
    /** '' = nothing selected yet */
    category: z.string(),
    channelIds: z.array(z.string()),
  })
  // The form shape isn't the request shape yet, so hand the values on as `unknown`
  .transform((values): unknown => values)
  .pipe(createAlertRuleRequestSchema);
export type AlertRuleFormValues = z.input<typeof alertRuleFormSchema>;

/**
 * Body of PATCH /api/alert-rules/:id. Only the fields that are sent change.
 * The on/off switch sends `{ enabled }`, the edit form sends everything.
 * Sending `type` requires its field (`keywords` or `category`); the backend clears the other one.
 * `keywords` or `category` without `type` is rejected, because it's unclear what was meant.
 * `channelIds` replaces the whole list.
 */
export const updateAlertRuleRequestSchema = z
  .object({
    name: alertRuleNameSchema.optional(),
    enabled: z.boolean('invalid').optional(),
    channelIds: channelIdsSchema.optional(),
    type: alertRuleTypeSchema.optional(),
    keywords: keywordsSchema.optional(),
    category: alertRuleCategorySchema.optional(),
  })
  .superRefine((body, ctx) => {
    if (body.type === 'keywords' && body.keywords === undefined) {
      ctx.addIssue({ code: 'custom', message: 'keywords.required', path: ['keywords'] });
    }
    if (body.type === 'category' && body.category === undefined) {
      ctx.addIssue({ code: 'custom', message: 'category.required', path: ['category'] });
    }
    if (body.type === undefined && (body.keywords !== undefined || body.category !== undefined)) {
      ctx.addIssue({ code: 'custom', message: 'alertRuleType.required', path: ['type'] });
    }
  });
export type UpdateAlertRuleRequest = z.infer<typeof updateAlertRuleRequestSchema>;
