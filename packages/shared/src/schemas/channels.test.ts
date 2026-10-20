import { describe, expect, it } from 'vitest';
import { CHANNEL_NAME_MAX_LENGTH } from '../constants/channels.js';
import { validationMessagesEn } from '../i18n/validation.en.js';
import {
  createChannelRequestSchema,
  editSlackChannelFormSchema,
  slackChannelConfigSchema,
  updateChannelRequestSchema,
} from './channels.js';

// A made-up URL in Slack's format, not a real webhook (Slack's own example has the shape of a
// real secret, so GitHub's push protection blocks it)
const webhookUrl = 'https://hooks.slack.com/services/TEXAMPLE/BEXAMPLE/notarealsecret';
const slack = { type: 'slack', name: '#news in Acme', webhookUrl };

/** Every key the tests below produce. Checked against the texts at the end. */
const producedKeys = new Set<string>();

/** Error keys per field, e.g. { webhookUrl: ['slackWebhookUrl.invalid'] }. */
function createErrors(input: unknown): Record<string, string[]> {
  const result = createChannelRequestSchema.safeParse(input);
  if (result.success) return {};
  const keys: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    const field = issue.path.join('.');
    keys[field] = [...(keys[field] ?? []), issue.message];
    producedKeys.add(issue.message);
  }
  return keys;
}

describe('createChannelRequestSchema', () => {
  it('accepts a Slack channel and trims both fields', () => {
    expect(
      createChannelRequestSchema.parse({
        ...slack,
        name: ' #news ',
        webhookUrl: ` ${webhookUrl} `,
      }),
    ).toEqual({ type: 'slack', name: '#news', webhookUrl });
  });

  it('needs a name of at most the max length', () => {
    expect(createErrors({ ...slack, name: '   ' })).toEqual({ name: ['channelName.required'] });
    expect(createErrors({ ...slack, name: undefined })).toEqual({ name: ['channelName.required'] });
    expect(createErrors({ ...slack, name: 'a'.repeat(CHANNEL_NAME_MAX_LENGTH) })).toEqual({});
    expect(createErrors({ ...slack, name: 'a'.repeat(CHANNEL_NAME_MAX_LENGTH + 1) })).toEqual({
      name: ['channelName.tooLong'],
    });
  });

  it('needs a webhook URL', () => {
    expect(createErrors({ ...slack, webhookUrl: '' })).toEqual({
      webhookUrl: ['slackWebhookUrl.required'],
    });
    expect(createErrors({ ...slack, webhookUrl: undefined })).toEqual({
      webhookUrl: ['slackWebhookUrl.required'],
    });
  });

  // Our server posts to this URL, so it must be Slack's webhook address and nothing else (SSRF)
  it.each([
    ['http instead of https', webhookUrl.replace('https:', 'http:')],
    ['another host', 'https://example.com/services/T0/B0/X0'],
    ['a host that only starts like Slack', 'https://hooks.slack.com.evil.com/services/T0/B0/X0'],
    ['a host that only ends like Slack', 'https://evilhooks.slack.com/services/T0/B0/X0'],
    ['extra text after it', `${webhookUrl}/../../api`],
    ['a query string', `${webhookUrl}?x=1`],
    ['a missing part', 'https://hooks.slack.com/services/TEXAMPLE/BEXAMPLE'],
    ['a Workflow webhook (expects another body)', 'https://hooks.slack.com/triggers/T0/1/abc'],
    ['two URLs', `${webhookUrl} ${webhookUrl}`],
  ])('rejects %s', (_case, url) => {
    expect(createErrors({ ...slack, webhookUrl: url })).toEqual({
      webhookUrl: ['slackWebhookUrl.invalid'],
    });
  });

  it('only creates Slack channels (every user already has one email channel)', () => {
    expect(createChannelRequestSchema.safeParse({ type: 'email' }).success).toBe(false);
    expect(createChannelRequestSchema.safeParse({ name: 'x', webhookUrl }).success).toBe(false);
  });
});

describe('updateChannelRequestSchema', () => {
  it('changes only the sent fields, with the same checks as connecting', () => {
    expect(updateChannelRequestSchema.parse({})).toEqual({});
    expect(updateChannelRequestSchema.parse({ name: ' #alerts ' })).toEqual({ name: '#alerts' });
    expect(updateChannelRequestSchema.parse({ webhookUrl })).toEqual({ webhookUrl });
    expect(updateChannelRequestSchema.safeParse({ name: '' }).success).toBe(false);
    expect(
      updateChannelRequestSchema.safeParse({ webhookUrl: 'https://example.com/services/T0/B0/X0' })
        .success,
    ).toBe(false);
  });
});

describe('editSlackChannelFormSchema', () => {
  it('keeps the current URL when the field is empty, otherwise needs a Slack webhook URL', () => {
    expect(editSlackChannelFormSchema.parse({ name: '#news', webhookUrl: '  ' })).toEqual({
      name: '#news',
      webhookUrl: '',
    });
    expect(editSlackChannelFormSchema.parse({ name: '#news', webhookUrl })).toEqual({
      name: '#news',
      webhookUrl,
    });
    const result = editSlackChannelFormSchema.safeParse({
      name: '#news',
      webhookUrl: 'https://example.com/x',
    });
    expect(result.error?.issues.map((issue) => issue.message)).toEqual(['slackWebhookUrl.invalid']);
  });
});

describe('slackChannelConfigSchema', () => {
  it('is what a Slack channel stores: name and webhook URL, no type', () => {
    expect(slackChannelConfigSchema.parse(slack)).toEqual({ name: '#news in Acme', webhookUrl });
  });
});

describe('validation texts', () => {
  it('has exactly one text for every channel form error key', () => {
    const groups = ['channelName', 'slackWebhookUrl'] as const;
    const textKeys = groups.flatMap((group) =>
      Object.keys(validationMessagesEn[group]).map((key) => `${group}.${key}`),
    );

    expect([...producedKeys].sort()).toEqual(textKeys.sort());
  });
});
