import type { AlertRuleList } from '@alert-app/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { UpdateAlertRuleVariables } from '../../types/alert-rules/alertRules';
import { getGetAlertRulesQueryKey, updateAlertRule } from '../generated/alert-rules/alert-rules';

/** Changes an alert rule (PATCH /api/alert-rules/:id), e.g. the on/off switch or the edit dialog. */
export function useUpdateAlertRule() {
  const queryClient = useQueryClient();

  return useMutation({
    // Our variables carry the whole rule, for messages like "Alert EV news turned off"
    mutationFn: ({ rule, changes }: UpdateAlertRuleVariables) => updateAlertRule(rule.id, changes),
    onSuccess: (updated) => {
      // Put the server's answer into the list right away, so the switch doesn't jump back
      // to its old position while the list reloads
      queryClient.setQueryData<AlertRuleList>(
        getGetAlertRulesQueryKey(),
        (list) =>
          list && { items: list.items.map((rule) => (rule.id === updated.id ? updated : rule)) },
      );
      return queryClient.invalidateQueries({ queryKey: getGetAlertRulesQueryKey() });
    },
  });
}
