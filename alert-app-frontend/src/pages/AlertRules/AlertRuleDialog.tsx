import {
  alertRuleFormSchema,
  type AlertRule,
  type AlertRuleFormValues,
  type Channel,
} from '@alert-app/shared';
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
import { useEffect, useEffectEvent, useId } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { FormTextField } from '../../global/components/FormTextField/FormTextField';
import { setServerErrors } from '../../global/utils/setServerErrors';
import type { AlertRuleDialogProps } from '../../types/alert-rules/alertRules';
import styles from './AlertRulesPage.module.scss';
import { ChannelsField } from './ChannelsField';
import { KeywordsField } from './KeywordsField';

/** The form starts from the rule being edited, or empty for a new one (sending to every channel). */
function toFormValues(rule: AlertRule | null, channels: Channel[]): AlertRuleFormValues {
  return {
    name: rule?.name ?? '',
    type: rule?.type ?? 'keywords',
    keywords: rule?.keywords ?? [],
    category: rule?.category ?? '',
    channelIds: rule?.channelIds ?? channels.map((channel) => channel.id),
  };
}

/** Create or edit an alert rule. Full screen on phones, where a small dialog is too cramped. */
export function AlertRuleDialog({
  open,
  rule,
  categories,
  channels,
  onSubmit,
  onClose,
}: AlertRuleDialogProps) {
  const { t } = useTranslation(['alerts', 'common']);
  const fullScreen = useMediaQuery((theme) => theme.breakpoints.down('sm'));
  const titleId = useId();
  const form = useForm({
    resolver: zodResolver(alertRuleFormSchema),
    mode: 'onTouched',
    defaultValues: toFormValues(rule, channels),
  });
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = form;
  const type = useWatch({ control, name: 'type' });

  // Start fresh every time the dialog opens. Only then: the channels can reload while it's open
  // (e.g. after connecting Slack in another tab), and that must not clear what was typed.
  // useEffectEvent reads the latest channels without making the effect run when they change.
  const resetForm = useEffectEvent(() => reset(toFormValues(rule, channels)));
  useEffect(() => {
    if (open) resetForm();
  }, [open, rule]);

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

          <ChannelsField control={control} channels={channels} />

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
