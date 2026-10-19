import { Button } from '@mui/material';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { PageLayout } from './PageLayout';

describe('PageLayout', () => {
  it('renders the title, description, actions and content', () => {
    renderWithProviders(
      <PageLayout title="My alerts" description="Some text" actions={<Button>New alert</Button>}>
        <p>Content</p>
      </PageLayout>,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'My alerts' })).toBeInTheDocument();
    expect(screen.getByText('Some text')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New alert' })).toBeInTheDocument();
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('sets the browser tab title', () => {
    renderWithProviders(<PageLayout title="My alerts" />);

    expect(document.title).toBe('My alerts · Alert App');
  });
});
