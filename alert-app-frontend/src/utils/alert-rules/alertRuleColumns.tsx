import type { AlertRule } from '@alert-app/shared';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { Chip, IconButton, Switch, Tooltip } from '@mui/material';
import type { DataTableColumn } from '../../global/components/DataTable/DataTable';
import styles from '../../pages/AlertRules/AlertRulesPage.module.scss';
import type { AlertRuleColumnsOptions } from '../../types/alert-rules/alertRules';

/**
 * Columns of the "My alerts" table. A function, not a plain constant, because the
 * cells need the translations and the page's action handlers.
 */
export function getAlertRuleColumns({
  t,
  pendingRuleId,
  onToggle,
  onEdit,
  onDelete,
}: AlertRuleColumnsOptions): DataTableColumn<AlertRule>[] {
  return [
    {
      key: 'name',
      header: t('list.columns.name'),
      cardPlacement: 'title',
      render: (rule) => rule.name,
    },
    {
      key: 'findsBy',
      header: t('list.columns.findsBy'),
      render: (rule) => (
        <span className={styles.chips}>
          {rule.type === 'keywords' ? (
            <>
              <span className={styles.chipsLabel}>{t('list.allKeywords')}</span>
              {rule.keywords.map((keyword) => (
                <Chip key={keyword} label={keyword} size="small" />
              ))}
            </>
          ) : (
            <>
              <span className={styles.chipsLabel}>{t('list.category')}</span>
              {rule.category && (
                <Chip
                  label={t(`common:categories.${rule.category}`)}
                  size="small"
                  color="primary"
                  variant="outlined"
                />
              )}
            </>
          )}
        </span>
      ),
    },
    {
      key: 'enabled',
      header: t('list.columns.enabled'),
      render: (rule) => (
        <Switch
          checked={rule.enabled}
          disabled={rule.id === pendingRuleId}
          onChange={() => onToggle(rule)}
          slotProps={{ input: { 'aria-label': t('list.toggle', { name: rule.name }) } }}
        />
      ),
    },
    {
      key: 'actions',
      header: t('list.columns.actions'),
      cardPlacement: 'action',
      align: 'right',
      render: (rule) => (
        <span className={styles.actions}>
          <Tooltip title={t('list.edit', { name: rule.name })}>
            <IconButton onClick={() => onEdit(rule)}>
              <EditOutlinedIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title={t('list.delete', { name: rule.name })}>
            <IconButton onClick={() => onDelete(rule)}>
              <DeleteOutlineIcon />
            </IconButton>
          </Tooltip>
        </span>
      ),
    },
  ];
}
