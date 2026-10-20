import {
  Alert,
  Button,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Typography,
  useMediaQuery,
} from '@mui/material';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Loading } from '../Loading/Loading';
import styles from './DataTable.module.scss';

export interface DataTableColumn<Row> {
  key: string;
  header: string;
  render: (row: Row) => ReactNode;
  /**
   * Where the column goes in the mobile card:
   * - `title`: the card heading (use for one column, e.g. the name)
   * - `action`: top right of the card, without a label (e.g. a menu button)
   * - `field` (default): a "label: value" line
   */
  cardPlacement?: 'title' | 'action' | 'field';
  align?: 'left' | 'right';
}

interface DataTableProps<Row> {
  /** Accessible name of the table, e.g. "Users". */
  label: string;
  columns: DataTableColumn<Row>[];
  rows: Row[];
  getRowKey: (row: Row) => string;
  /** Server-side paging. Leave it out for short lists that are loaded at once. */
  pagination?: {
    /** Number of rows on all pages together. */
    total: number;
    /** 1-based, like our API. */
    page: number;
    pageSize: number;
    onPageChange: (page: number) => void;
  };
  /** First load: shows a spinner instead of the rows. */
  isLoading?: boolean;
  /** Loading another page while the current rows stay visible. */
  isFetching?: boolean;
  /** Shown instead of the rows, with a "Try again" button. */
  errorMessage?: string;
  onRetry?: () => void;
  emptyText: string;
}

/**
 * A list: a table on wide screens (md and up), cards on smaller ones,
 * because a table with many columns doesn't fit on a phone.
 * With `pagination`, paging happens on the server: `rows` is one page, `total` counts all rows.
 */
export function DataTable<Row>({
  label,
  columns,
  rows,
  getRowKey,
  pagination,
  isLoading = false,
  isFetching = false,
  errorMessage,
  onRetry,
  emptyText,
}: DataTableProps<Row>) {
  const { t } = useTranslation();
  const isWide = useMediaQuery((theme) => theme.breakpoints.up('md'));

  if (isLoading) return <Loading />;

  if (errorMessage) {
    return (
      <Alert
        severity="error"
        action={
          onRetry && (
            <Button color="inherit" size="small" onClick={onRetry}>
              {t('table.retry')}
            </Button>
          )
        }
      >
        {errorMessage}
      </Alert>
    );
  }

  if (rows.length === 0) {
    return (
      <Typography color="text.secondary" className={styles.empty}>
        {emptyText}
      </Typography>
    );
  }

  return (
    <div className={isFetching ? styles.fetching : undefined} aria-busy={isFetching}>
      {isWide ? (
        <TableContainer className={styles.tableContainer}>
          <Table aria-label={label}>
            <TableHead>
              <TableRow>
                {columns.map((column) => (
                  <TableCell key={column.key} align={column.align}>
                    {column.header}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={getRowKey(row)} hover>
                  {columns.map((column) => (
                    <TableCell key={column.key} align={column.align}>
                      {column.render(row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <ul className={styles.cards} aria-label={label}>
          {rows.map((row) => (
            <li key={getRowKey(row)}>
              <RowCard row={row} columns={columns} />
            </li>
          ))}
        </ul>
      )}
      {pagination && (
        <TablePagination
          component="div"
          count={pagination.total}
          // MUI counts pages from 0
          page={pagination.page - 1}
          onPageChange={(_event, newPage) => pagination.onPageChange(newPage + 1)}
          rowsPerPage={pagination.pageSize}
          rowsPerPageOptions={[]}
          labelDisplayedRows={({ from, to, count }) =>
            t('table.displayedRows', { from, to, count })
          }
          getItemAriaLabel={(type) => t(`table.${type}Page`)}
        />
      )}
    </div>
  );
}

function RowCard<Row>({ row, columns }: { row: Row; columns: DataTableColumn<Row>[] }) {
  const title = columns.find((column) => column.cardPlacement === 'title');
  const action = columns.find((column) => column.cardPlacement === 'action');
  const fields = columns.filter(
    (column) => !column.cardPlacement || column.cardPlacement === 'field',
  );

  return (
    <Card variant="outlined">
      <CardContent>
        <div className={styles.cardHeader}>
          {title && (
            <Typography variant="subtitle1" component="h2" className={styles.cardTitle}>
              {title.render(row)}
            </Typography>
          )}
          {action?.render(row)}
        </div>
        <dl className={styles.fields}>
          {fields.map((column) => (
            <div key={column.key} className={styles.field}>
              <dt>{column.header}</dt>
              <dd>{column.render(row)}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
