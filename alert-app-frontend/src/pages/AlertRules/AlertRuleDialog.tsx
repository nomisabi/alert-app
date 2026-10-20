import { alertRuleFormSchema, type AlertRule, type AlertRuleFormValues } from '@alert-app/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormLabel,
  MenuItem,
  Radio,
  RadioGroup,
  useMediaQuery,
} from '@mui/material';
import { useEffect, useId } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { FormTextField } from '../../global/components/FormTextField/FormTextField';
import { setServerErrors } from '../../global/utils/setServerErrors';
import type { AlertRuleDialogProps } from '../../types/alert-rules/alertRules';
import styles from './AlertRulesPage.module.scss';
import { KeywordsField } from './KeywordsField';

/** The form starts from the rule being edited, or empty for a new one. */
function toFormValues(rule: AlertRule | null): AlertRuleFormValues {
  return {
    name: rule?.name ?? '',
    type: rule?.type ?? 'keywords',
    keywords: rule?.keywords ?? [],
    category: rule?.category ?? '',
  };
}

/** Create or edit an alert rule. Full screen on phones, where a small dialog is too cramped. */
export function AlertRuleDialog({
  open,
  rule,
  categories,
  onSubmit,
  onClose,
}: AlertRuleDialogProps) {
  const { t } = useTranslation(['alerts', 'common']);
  const fullScreen = useMediaQuery((theme) => theme.breakpoints.down('sm'));
  const titleId = useId();
  const form = useForm({
    resolver: zodResolver(alertRuleFormSchema),
    mode: 'onTouched',
    defaultValues: toFormValues(rule),
  });
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = form;
  const type = useWatch({ control, name: 'type' });

  // Start fresh every time the dialog opens
  useEffect(() => {
    if (open) reset(toFormValues(rule));
  }, [open, rule, reset]);

  const close = () => {
    if (!isSubmitting) onClose();
  };

  const submit = handleSubmit(async (values) => {
    try {
      await onSubmit(values);
    } catch (error) {
      setServerErrors(error, form);
    }
  });

  return (
    <Dialog
      open={open}
      onClose={close}
      fullScreen={fullScreen}
      fullWidth
      maxWidth="sm"
      aria-labelledby={titleId}
    >
      {/* noValidate: we show our own messages instead of the browser's validation bubbles */}
      <form className={styles.form} onSubmit={submit} noValidate>
        <DialogTitle id={titleId}>
          {rule ? t('dialog.editTitle') : t('dialog.createTitle')}
        </DialogTitle>
        <DialogContent className={styles.fields}>
          <FormTextField
            control={control}
            name="name"
            label={t('dialog.name')}
            helperText={t('dialog.nameHint')}
            autoComplete="off"
            autoFocus
            required
          />

          <Controller
            control={control}
            name="type"
            render={({ field }) => (
              <FormControl component="fieldset">
                <FormLabel component="legend">{t('dialog.type')}</FormLabel>
                <RadioGroup row {...field}>
                  <FormControlLabel
                    value="keywords"
                    control={<Radio />}
                    label={t('dialog.types.keywords')}
                  />
                  <FormControlLabel
                    value="category"
                    control={<Radio />}
                    label={t('dialog.types.category')}
                  />
                </RadioGroup>
              </FormControl>
            )}
          />

          {/* Both values stay in the form, so switching back doesn't lose them. Only the selected one is sent. */}
          {type === 'keywords' ? (
            <KeywordsField control={control} />
          ) : (
            <FormTextField
              control={control}
              name="category"
              select
              label={t('dialog.category')}
              helperText={t('dialog.categoryHint')}
              required
            >
              {categories.map((category) => (
                <MenuItem key={category} value={category}>
                  {t(`common:categories.${category}`)}
                </MenuItem>
              ))}
            </FormTextField>
          )}

          {errors.root?.server && <Alert severity="error">{errors.root.server.message}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={close} disabled={isSubmitting}>
            {t('common:actions.cancel')}
          </Button>
          <Button type="submit" variant="contained" loading={isSubmitting}>
            {rule ? t('dialog.save') : t('dialog.create')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
