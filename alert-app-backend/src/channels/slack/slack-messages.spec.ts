import { DESCRIPTION_MAX_LENGTH } from '../article-text.js';
import type { AlertArticle } from '../notification-channel.js';
import {
  escapeSlack,
  SLACK_ARTICLES_MAX,
  slackMessage,
  type SlackBlock,
} from './slack-messages.js';

const article = (changes: Partial<AlertArticle> = {}): AlertArticle => ({
  title: 'Tesla unveils a cheaper model',
  url: 'https://example.com/tesla',
  description: 'The electric-car maker says it will cost less.',
  sourceName: 'Example News',
  publishedAt: new Date('2026-10-19T20:21:00Z'),
  ...changes,
});

const alert = (articles: AlertArticle[], ruleName = 'EV news') =>
  slackMessage(
    { kind: 'alert', ruleName, articles, alertsUrl: 'http://localhost:5174/alerts' },
    'en',
  );

/** The mrkdwn text of a section block. */
const sectionText = (block: SlackBlock | undefined) =>
  block?.type === 'section' ? block.text.text : undefined;

describe('slackMessage', () => {
  it('test message: a short text that says where alerts are posted', () => {
    const { text, blocks } = slackMessage({ kind: 'test' }, 'en');

    expect(text).toBe('Alert App is connected');
    expect(sectionText(blocks[0])).toContain('Alerts that use this channel are posted here.');
  });

  it('alert: a header with the rule name and count, one block per article, a link to the app', () => {
    const { text, blocks } = alert([article(), article({ url: 'https://example.com/2' })]);

    expect(text).toBe('2 new articles for your alert “EV news”');
    expect(blocks[0]).toEqual({
      type: 'header',
      text: { type: 'plain_text', text: '2 new articles for your alert “EV news”' },
    });
    expect(sectionText(blocks[1])).toBe(
      [
        '*<https://example.com/tesla|Tesla unveils a cheaper model>*',
        'Example News · Oct 19, 2026, 8:21 PM UTC',
        'The electric-car maker says it will cost less.',
      ].join('\n'),
    );
    expect(blocks.at(-2)).toEqual({ type: 'divider' });
    expect(sectionText(blocks.at(-1))).toBe('<http://localhost:5174/alerts|Manage your alerts>');
    expect(alert([article()]).text).toBe('New article for your alert “EV news”');
  });

  it('works without a source or description', () => {
    const { blocks } = alert([article({ sourceName: null, description: null })]);

    expect(sectionText(blocks[1])).toBe(
      '*<https://example.com/tesla|Tesla unveils a cheaper model>*\nOct 19, 2026, 8:21 PM UTC',
    );
  });

  // Slack reads <...> as links and mentions, e.g. "<!channel>" would notify everyone
  it('escapes &, < and > in texts from outside, so they show as written', () => {
    const { text, blocks } = alert(
      [
        article({
          title: 'AT&T <!channel> deal',
          description: 'Profits > 5% <@U123>',
          sourceName: 'News & <More>',
        }),
      ],
      'R&D <news>',
    );

    expect(text).toBe('New article for your alert “R&amp;D &lt;news&gt;”');
    // A header is plain text: Slack shows it as it is
    expect(blocks[0]).toMatchObject({ text: { text: 'New article for your alert “R&D <news>”' } });
    const section = sectionText(blocks[1]);
    expect(section).toContain('|AT&amp;T &lt;!channel&gt; deal>');
    expect(section).toContain('News &amp; &lt;More&gt; ·');
    expect(section).toContain('Profits &gt; 5% &lt;@U123&gt;');
  });

  it('keeps a | or > in a URL from ending the link early', () => {
    const { blocks } = alert([article({ url: 'https://example.com/a|b?x=1&y=>2' })]);

    expect(sectionText(blocks[1])).toContain(
      '<https://example.com/a%7Cb?x=1&amp;y=&gt;2|Tesla unveils a cheaper model>',
    );
  });

  it('links only web URLs (a provider could send a "javascript:" link)', () => {
    const { blocks } = alert([article({ url: 'javascript:alert(1)' })]);

    expect(sectionText(blocks[1])).toMatch(/^\*Tesla unveils a cheaper model\*\n/);
  });

  it('drops the link of a URL so long that Slack would refuse the message (3,000 per section)', () => {
    const longUrl = `https://example.com/a?${'tracking=x&'.repeat(300)}`;
    const { blocks } = alert([article({ url: longUrl })]);
    const section = sectionText(blocks[1])!;

    expect(section.length).toBeLessThanOrEqual(3000);
    expect(section).toMatch(/^\*Tesla unveils a cheaper model\*\n/);
    expect(section).not.toContain('example.com/a');
  });

  it('keeps every section under 3,000 characters, even with the longest title and description', () => {
    // & is escaped to &amp;, so these are 5 times longer after escaping
    const { blocks } = alert([
      article({
        title: '&'.repeat(400),
        description: '&'.repeat(400),
        url: `https://example.com/${'x'.repeat(2000)}`,
      }),
    ]);

    expect(sectionText(blocks[1])!.length).toBeLessThanOrEqual(3000);
  });

  it('shortens long descriptions and very long titles', () => {
    const { blocks } = alert([
      article({ title: 'T'.repeat(400), description: 'word '.repeat(200) }),
    ]);
    const [title, , description] = sectionText(blocks[1])!.split('\n');

    expect(title.length).toBeLessThanOrEqual(300);
    expect(title).toContain('…');
    expect(description.length).toBeLessThanOrEqual(DESCRIPTION_MAX_LENGTH + 1);
    expect(description).toMatch(/word…$/);
  });

  it(`shows at most ${SLACK_ARTICLES_MAX} articles and says how many more there are`, () => {
    const articles = Array.from({ length: SLACK_ARTICLES_MAX + 3 }, (_, i) =>
      article({ url: `https://example.com/${i}` }),
    );
    const { text, blocks } = alert(articles);

    expect(text).toBe(`${SLACK_ARTICLES_MAX + 3} new articles for your alert “EV news”`);
    expect(blocks.filter((block) => sectionText(block)?.startsWith('*<'))).toHaveLength(
      SLACK_ARTICLES_MAX,
    );
    expect(blocks).toContainEqual({
      type: 'context',
      elements: [{ type: 'mrkdwn', text: '…and 3 more articles.' }],
    });
    // Slack's limit is 50 blocks per message
    expect(blocks.length).toBeLessThanOrEqual(50);
    expect(alert(articles.slice(0, SLACK_ARTICLES_MAX)).blocks).not.toContainEqual(
      expect.objectContaining({ type: 'context' }),
    );
  });

  it('cuts a header longer than Slack allows (150 characters)', () => {
    const { blocks } = alert([article()], 'x'.repeat(200));

    expect(blocks[0].type === 'header' && blocks[0].text.text.length).toBe(150);
  });
});

describe('escapeSlack', () => {
  it('escapes & first, so it is not escaped twice', () => {
    expect(escapeSlack('&lt; & <')).toBe('&amp;lt; &amp; &lt;');
  });
});
