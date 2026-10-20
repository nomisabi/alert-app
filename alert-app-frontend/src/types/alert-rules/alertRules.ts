import type {
  AlertRule,
  AlertRuleFormValues,
  AppCategory,
  CreateAlertRuleRequest,
  UpdateAlertRuleRequest,
} from '@alert-app/shared';
import type { TFunction } from 'i18next';
import type { Control } from 'react-hook-form';

/** Input of useUpdateAlertRule: the whole rule (for messages) and the changes. */
export interface UpdateAlertRuleVariables {
  rule: AlertRule;
  changes: UpdateAlertRuleRequest;
}

/** Everything the alert rules table columns need from the page. */
export interface AlertRuleColumnsOptions {
  t: TFunction<['alerts', 'common']>;
  /** The rule whose on/off change is being saved (its switch is disabled). */
  pendingRuleId: string | undefined;
  onToggle: (rule: AlertRule) => void;
  onEdit: (rule: AlertRule) => void;
  onDelete: (rule: AlertRule) => void;
}

export interface AlertRuleDialogProps {
  open: boolean;
  /** The rule to edit, or null to create a new one. */
  rule: AlertRule | null;
  /** Options of the category select, in display order. */
  categories: AppCategory[];
  /** Throws an ApiRequestError when the server rejects the rule. The page closes the dialog. */
  onSubmit: (values: CreateAlertRuleRequest) => Promise<unknown>;
  onClose: () => void;
}

export interface KeywordsFieldProps {
  /** The form keeps keywords and category; on submit it hands on the request body. */
  control: Control<AlertRuleFormValues, unknown, CreateAlertRuleRequest>;
}
