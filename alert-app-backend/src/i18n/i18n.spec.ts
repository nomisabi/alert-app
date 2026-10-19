import { pickLanguage, translateErrorCode, translateKey } from './i18n.js';

describe('pickLanguage', () => {
  it('picks a supported language from the Accept-Language header', () => {
    expect(pickLanguage('en-US,en;q=0.9')).toBe('en');
  });

  it('falls back to English for unsupported or missing languages', () => {
    expect(pickLanguage('de-DE,de;q=0.9')).toBe('en');
    expect(pickLanguage(undefined)).toBe('en');
    expect(pickLanguage('')).toBe('en');
  });
});

describe('translateErrorCode', () => {
  it('uses the text for the code', () => {
    expect(translateErrorCode('en', 'USERNAME_IS_ALREADY_TAKEN', 400)).toBe(
      'This username is already taken.',
    );
  });

  it('falls back to the text for the HTTP status when the code is unknown', () => {
    expect(translateErrorCode('en', 'SOMETHING_NEW', 403)).toBe(
      "You don't have permission to do this.",
    );
    expect(translateErrorCode('en', 'SOMETHING_NEW', 502)).toBe(
      'Something went wrong. Please try again later.',
    );
  });
});

describe('translateKey', () => {
  it('translates validation keys with their values', () => {
    expect(translateKey('en', 'validation:username.tooShort')).toBe('Use at least 6 characters.');
  });

  it('uses a general text for unknown keys (e.g. Zod default messages)', () => {
    expect(translateKey('en', 'validation:Invalid input: expected string')).toBe(
      'This value is not valid.',
    );
  });
});
