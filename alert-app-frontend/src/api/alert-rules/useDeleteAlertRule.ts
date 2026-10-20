import type { AlertRule } from '@alert-app/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteAlertRule, getGetAlertRulesQueryKey } from '../generated/alert-rules/alert-rules';

/** Deletes an alert rule (DELETE /api/alert-rules/:id), then reloads the list. */
export function useDeleteAlertRule() {
  const queryClient = useQueryClient();

  return useMutation({
    // The whole rule, so the page can name it in the message
    mutationFn: (rule: AlertRule) => deleteAlertRule(rule.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetAlertRulesQueryKey() }),
  });
}
