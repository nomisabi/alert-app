import type { AlertRule } from '@alert-app/shared';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { Chip, IconButton, Switch, Tooltip } from '@mui/material';
import { ChannelIcon } from '../../global/components/ChannelIcon/ChannelIcon';
import type { DataTableColumn } from '../../global/components/DataTable/DataTable';
import styles from '../../pages/AlertRules/AlertRulesPage.module.scss';
import type { AlertRuleColumnsOptions } from '../../types/alert-rules/alertRules';

/**
 * Columns of the "My alerts" table. A function, not a plain constant, because the
 * cells need the translations and the page's action handlers.
 */
export function getAlertRuleColumns({
  t,
  channels,
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
      key: 'channels',
      header: t('list.columns.channels'),
      render: (rule) => (
        <span className={styles.channels}>
          {/* In the order of the channel list. Ids without a loaded channel are skipped. */}
          {channels
            .filter((channel) => rule.channelIds.includes(channel.id))
            .map((channel) => (
              // Tooltip also sets the text as the icon's aria-label, so screen readers read it.
              // enterTouchDelay 0: a tap shows it on touch screens.
              <Tooltip
                key={channel.id}
                title={t('dialog.channelOption', {
                  type: t(`channels:types.${channel.type}`),
                  destination: channel.destination,
                })}
                enterTouchDelay={0}
              >
                <span role="img" className={styles.channelIcon}>
                  <ChannelIcon type={channel.type} fontSize="small" />
                </span>
              </Tooltip>
            ))}
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
