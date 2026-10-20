import { Button } from '@mui/material';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { DataTable, type DataTableColumn } from './DataTable';

interface Fruit {
  id: string;
  name: string;
  color: string;
}

const fruits: Fruit[] = [
  { id: '1', name: 'Apple', color: 'red' },
  { id: '2', name: 'Banana', color: 'yellow' },
];

const columns: DataTableColumn<Fruit>[] = [
  { key: 'name', header: 'Name', cardPlacement: 'title', render: (fruit) => fruit.name },
  { key: 'color', header: 'Color', render: (fruit) => fruit.color },
  {
    key: 'actions',
    header: 'Actions',
    cardPlacement: 'action',
    render: (fruit) => <Button>Edit {fruit.name}</Button>,
  },
];

function renderTable(props: Partial<Parameters<typeof DataTable<Fruit>>[0]> = {}, page = 1) {
  const onPageChange = vi.fn();
  renderWithProviders(
    <DataTable
      label="Fruits"
      columns={columns}
      rows={fruits}
      getRowKey={(fruit) => fruit.id}
      pagination={{ total: 45, page, pageSize: 20, onPageChange }}
      emptyText="No fruits"
      {...props}
    />,
  );
  return { onPageChange };
}

/** jsdom has no screen size: pretend the screen is wide (md and up) or narrow. */
function setWideScreen(wide: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: wide,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

describe('DataTable', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows a table with headers on wide screens', () => {
    setWideScreen(true);
    renderTable();

    const table = screen.getByRole('table', { name: 'Fruits' });
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent),
    ).toEqual(['Name', 'Color', 'Actions']);
    expect(within(table).getAllByRole('row')).toHaveLength(3);
  });

  it('shows one card per row on small screens: title, action and "label: value" lines', () => {
    setWideScreen(false);
    renderTable();

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    const cards = within(screen.getByRole('list', { name: 'Fruits' })).getAllByRole('listitem');
    expect(cards).toHaveLength(2);

    const apple = cards[0]!;
    expect(within(apple).getByRole('heading', { name: 'Apple' })).toBeInTheDocument();
    expect(within(apple).getByRole('button', { name: 'Edit Apple' })).toBeInTheDocument();
    expect(within(apple).getByText('Color')).toBeInTheDocument();
    expect(within(apple).getByText('red')).toBeInTheDocument();
  });

  it('pages on the server, counting pages from 1', async () => {
    const user = userEvent.setup();
    const { onPageChange } = renderTable({}, 2);

    expect(screen.getByText('21–40 of 45')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Go to next page' }));
    expect(onPageChange).toHaveBeenCalledWith(3);
    await user.click(screen.getByRole('button', { name: 'Go to previous page' }));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it('shows no pagination for lists without it', () => {
    renderTable({ pagination: undefined });

    expect(screen.getByText('Apple')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Go to next page' })).not.toBeInTheDocument();
  });

  it('shows the empty text when there are no rows', () => {
    renderTable({ rows: [], pagination: undefined });

    expect(screen.getByText('No fruits')).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('shows the error with a "Try again" button instead of the rows', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    renderTable({ errorMessage: 'Could not load the fruits.', onRetry });

    expect(screen.getByRole('alert')).toHaveTextContent('Could not load the fruits.');
    expect(screen.queryByText('Apple')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('shows a spinner on the first load', async () => {
    renderTable({ isLoading: true });

    expect(await screen.findByRole('progressbar', { name: 'Loading…' })).toBeInTheDocument();
    expect(screen.queryByText('Apple')).not.toBeInTheDocument();
  });
});
