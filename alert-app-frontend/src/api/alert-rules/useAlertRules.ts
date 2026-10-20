import { useGetAlertRules } from '../generated/alert-rules/alert-rules';

/** The logged-in user's alert rules, newest first (GET /api/alert-rules). */
export function useAlertRules() {
  return useGetAlertRules();
}
