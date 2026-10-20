import { testMessageEmail } from './test-message.js';

describe('testMessageEmail', () => {
  const email = testMessageEmail({ language: 'en', to: 'ann@example.com', name: 'Ann' });

  it('goes to the address with a translated subject', () => {
    expect(email).toMatchObject({
      to: 'ann@example.com',
      subject: 'Your Alert App email channel works',
    });
  });

  it('has a plain-text version with the greeting and the address', () => {
    expect(email.text).toContain('Hi Ann,');
    expect(email.text).toContain('Alerts that use this channel are sent to ann@example.com.');
  });

  it('is a full HTML document in the language of the email', () => {
    expect(email.html).toMatch(/^<!doctype html>/);
    expect(email.html).toContain('<html lang="en">');
    expect(email.html).toContain('<title>Your Alert App email channel works</title>');
  });

  it('shows HTML in names as text, not as markup', () => {
    const { html, text } = testMessageEmail({
      language: 'en',
      to: 'ann@example.com',
      name: '<b>Ann</b> & "Co"',
    });

    expect(html).toContain('Hi &lt;b&gt;Ann&lt;/b&gt; &amp; &quot;Co&quot;,');
    expect(html).not.toContain('<b>Ann</b>');
    // The plain-text version isn't HTML, so it keeps the name as it is
    expect(text).toContain('Hi <b>Ann</b> & "Co",');
  });
});
