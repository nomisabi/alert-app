import type { CreateAlertRuleRequest } from '@alert-app/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createAlertRule, getGetAlertRulesQueryKey } from '../generated/alert-rules/alert-rules';

/** Creates an alert rule (POST /api/alert-rules), then reloads the list. */
export function useCreateAlertRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (rule: CreateAlertRuleRequest) => createAlertRule(rule),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetAlertRulesQueryKey() }),
  });
}
