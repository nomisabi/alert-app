import type { AlertArticle } from '../../channels/notification-channel.js';
import { alertEmail, DESCRIPTION_MAX_LENGTH } from './alert.js';

const article = (changes: Partial<AlertArticle> = {}): AlertArticle => ({
  title: 'Tesla unveils a cheaper model',
  url: 'https://example.com/tesla',
  description: 'The electric-car maker says it will cost less.',
  sourceName: 'Example News',
  publishedAt: new Date('2026-10-19T20:21:00Z'),
  ...changes,
});

const email = (articles: AlertArticle[], ruleName = 'EV news', name = 'Ann') =>
  alertEmail({
    language: 'en',
    to: 'ann@example.com',
    name,
    ruleName,
    articles,
    alertsUrl: 'http://localhost:5174/alerts',
  });

describe('alertEmail', () => {
  it('has a subject with the rule name and the number of articles', () => {
    expect(email([article()]).subject).toBe('New article for your alert “EV news”');
    expect(email([article(), article({ url: 'https://example.com/2' })]).subject).toBe(
      '2 new articles for your alert “EV news”',
    );
  });

  it('lists every article: title, source and date (UTC), description, link', () => {
    const { text, html, to } = email([article()]);

    expect(to).toBe('ann@example.com');
    expect(text).toContain('Your alert “EV news” found a new article:');
    expect(text).toContain(
      [
        'Tesla unveils a cheaper model',
        'Example News · Oct 19, 2026, 8:21 PM UTC',
        'The electric-car maker says it will cost less.',
        'https://example.com/tesla',
      ].join('\n'),
    );
    expect(html).toContain('href="https://example.com/tesla"');
    expect(html).toContain('Example News · Oct 19, 2026, 8:21 PM UTC');
  });

  it('leaves out what an article does not have', () => {
    const { text } = email([article({ sourceName: null, description: null })]);

    expect(text).toContain('Tesla unveils a cheaper model\nOct 19, 2026, 8:21 PM UTC\nhttps://');
  });

  it('links to the alerts page', () => {
    const { text, html } = email([article()]);

    expect(text).toContain('Manage your alerts: http://localhost:5174/alerts');
    expect(html).toContain('href="http://localhost:5174/alerts"');
  });

  it('shortens long descriptions without cutting a word', () => {
    const long = `${'word '.repeat(100)}end`;
    const { text } = email([article({ description: long })]);

    const shortened = text.split('\n').find((line) => line.startsWith('word'))!;
    expect(shortened.length).toBeLessThanOrEqual(DESCRIPTION_MAX_LENGTH + 1);
    expect(shortened).toMatch(/word…$/);
  });

  it('shows HTML in names, titles and descriptions as text, and links only web addresses', () => {
    const { html } = email(
      [
        article({
          title: '<script>alert(1)</script>',
          description: '<b>bold</b>',
          url: 'javascript:alert(1)',
        }),
      ],
      '<i>Rule</i>',
      '<b>Ann</b>',
    );

    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<b>');
    expect(html).not.toContain('<i>Rule</i>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('href="javascript:');
  });
});
