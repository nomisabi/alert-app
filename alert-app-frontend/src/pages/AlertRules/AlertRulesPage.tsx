import {
  ALERT_RULES_PER_USER_MAX,
  type AlertRule,
  type CreateAlertRuleRequest,
} from '@alert-app/shared';
import AddIcon from '@mui/icons-material/Add';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import { Alert, Button } from '@mui/material';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAlertRules } from '../../api/alert-rules/useAlertRules';
import { useCreateAlertRule } from '../../api/alert-rules/useCreateAlertRule';
import { useDeleteAlertRule } from '../../api/alert-rules/useDeleteAlertRule';
import { useUpdateAlertRule } from '../../api/alert-rules/useUpdateAlertRule';
import { useCategories } from '../../api/categories/useCategories';
import { useChannels } from '../../api/channels/useChannels';
import { ConfirmDialog } from '../../global/components/ConfirmDialog/ConfirmDialog';
import { DataTable } from '../../global/components/DataTable/DataTable';
import { EmptyState } from '../../global/components/EmptyState/EmptyState';
import { PageLayout } from '../../global/components/PageLayout/PageLayout';
import { useNotify } from '../../global/hooks/useNotify';
import { getAlertRuleColumns } from '../../utils/alert-rules/alertRuleColumns';
import { AlertRuleDialog } from './AlertRuleDialog';
import styles from './AlertRulesPage.module.scss';
export function AlertRulesPage() {
  const { t } = useTranslation(['alerts', 'common', 'channels']);
  const notify = useNotify();

  const alertRules = useAlertRules();
  const categories = useCategories();
  const channels = useChannels();
  const createRule = useCreateAlertRule();
  const updateRule = useUpdateAlertRule();
  const deleteRule = useDeleteAlertRule();

  // Separate "open" and "rule", so the dialog keeps its title while it fades out
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editedRule, setEditedRule] = useState<AlertRule | null>(null);
  const [ruleToDelete, setRuleToDelete] = useState<AlertRule | null>(null);

  const rules = alertRules.data?.items ?? [];
  // useMemo: the same array on every render, so the dialog doesn't reset its form each time
  const channelList = useMemo(() => channels.data?.items ?? [], [channels.data]);
  // The list shows the channels and the dialog needs them, so both must be loaded
  const isLoaded = alertRules.isSuccess && channels.isSuccess;
  // Only once the list has loaded: "empty" while loading would flash the empty state
  const isEmpty = isLoaded && rules.length === 0;
  const limitReached = rules.length >= ALERT_RULES_PER_USER_MAX;

  const openDialog = (rule: AlertRule | null) => {
    setEditedRule(rule);
    setDialogOpen(true);
  };

  // mutateAsync: the dialog awaits it and shows server errors under the fields when it throws
  const save = async (values: CreateAlertRuleRequest) => {
    const saved = editedRule
      ? await updateRule.mutateAsync({ rule: editedRule, changes: values })
      : await createRule.mutateAsync(values);
    setDialogOpen(false);
    notify(t(editedRule ? 'notify.updated' : 'notify.created', { name: saved.name }));
  };

  const toggle = (rule: AlertRule) =>
    updateRule.mutate(
      { rule, changes: { enabled: !rule.enabled } },
      {
        onSuccess: (updated) =>
          notify(t(updated.enabled ? 'notify.enabled' : 'notify.disabled', { name: updated.name })),
        onError: (error) => notify(error.message, 'error'),
      },
    );

  const remove = (rule: AlertRule) =>
    deleteRule.mutate(rule, {
      onSuccess: () => {
        setRuleToDelete(null);
        notify(t('notify.deleted', { name: rule.name }));
      },
      onError: (error) => notify(error.message, 'error'),
    });

  const columns = getAlertRuleColumns({
    t,
    channels: channelList,
    pendingRuleId: updateRule.isPending ? updateRule.variables.rule.id : undefined,
    onToggle: toggle,
    onEdit: openDialog,
    onDelete: setRuleToDelete,
  });

  return (
    <PageLayout
      title={t('list.title')}
      description={t('list.description')}
      actions={
        // The empty state has its own button
        isLoaded &&
        !isEmpty && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            disabled={limitReached}
            onClick={() => openDialog(null)}
          >
            {t('list.new')}
          </Button>
        )
      }
    >
      {limitReached && (
        <Alert severity="info" className={styles.limit}>
          {t('list.limitReached', { max: ALERT_RULES_PER_USER_MAX })}
        </Alert>
      )}

      {isEmpty ? (
        <EmptyState
          icon={<NotificationsNoneIcon />}
          title={t('list.empty.title')}
          description={t('list.empty.description')}
          action={
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => openDialog(null)}>
              {t('list.empty.action')}
            </Button>
          }
        />
      ) : (
        <DataTable
          label={t('list.tableLabel')}
          columns={columns}
          rows={rules}
          getRowKey={(rule) => rule.id}
          isLoading={alertRules.isPending || channels.isPending}
          errorMessage={alertRules.isError || channels.isError ? t('list.loadError') : undefined}
          onRetry={() => {
            if (alertRules.isError) void alertRules.refetch();
            if (channels.isError) void channels.refetch();
          }}
          emptyText={t('list.empty.title')}
        />
      )}

      <AlertRuleDialog
        open={dialogOpen}
        rule={editedRule}
        categories={categories.data ?? []}
        channels={channelList}
        onSubmit={save}
        onClose={() => setDialogOpen(false)}
      />

      <ConfirmDialog
        open={Boolean(ruleToDelete)}
        title={t('deleteDialog.title', { name: ruleToDelete?.name })}
        description={t('deleteDialog.description')}
        confirmLabel={t('deleteDialog.confirm')}
        destructive
        isPending={deleteRule.isPending}
        onConfirm={() => ruleToDelete && remove(ruleToDelete)}
        onClose={() => setRuleToDelete(null)}
      />
    </PageLayout>
  );
}
