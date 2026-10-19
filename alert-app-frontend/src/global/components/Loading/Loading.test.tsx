import { act, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { Loading } from './Loading';

describe('Loading', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the spinner only after the delay', () => {
    renderWithProviders(<Loading />);

    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(screen.getByRole('progressbar', { name: 'Loading…' })).toBeInTheDocument();
  });

  it('shows the spinner immediately when the delay is 0', () => {
    renderWithProviders(<Loading delay={0} />);

    expect(screen.getByRole('progressbar', { name: 'Loading…' })).toBeInTheDocument();
  });
});
