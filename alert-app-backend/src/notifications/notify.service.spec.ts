import { failureText } from './notify.service.js';

describe('failureText', () => {
  it('says a permanent error is not retried, without "1/3"', () => {
    expect(failureText(1, 3, true)).toBe('failed, not retried (permanent error)');
  });

  it('says when there will be another attempt, and when it gives up', () => {
    expect(failureText(1, 3, false)).toBe('attempt 1/3 failed, will retry');
    expect(failureText(2, 3, false)).toBe('attempt 2/3 failed, will retry');
    expect(failureText(3, 3, false)).toBe('attempt 3/3 failed, giving up');
  });
});
