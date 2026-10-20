import { editSlackChannelFormSchema, slackChannelConfigSchema } from '@alert-app/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Link,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useEffect, useId } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { FormTextField } from '../../global/components/FormTextField/FormTextField';
import { setServerErrors } from '../../global/utils/setServerErrors';
import type {
  SlackChannelDialogProps,
  SlackChannelFormValues,
} from '../../types/channels/channels';
import styles from './ChannelsPage.module.scss';

const SLACK_WEBHOOKS_GUIDE_URL =
  'https://docs.slack.dev/messaging/sending-messages-using-incoming-webhooks';

/**
 * Connect Slack, or edit it (`channel` set): a name and the webhook URL, with short steps for
 * getting the URL in Slack. When editing, the URL field starts empty (the API never returns the
 * URL): empty keeps the current one. Full screen on phones, where a small dialog is too cramped.
 */
export function SlackChannelDialog({ open, channel, onSubmit, onClose }: SlackChannelDialogProps) {
  const { t } = useTranslation(['channels', 'common']);
  const fullScreen = useMediaQuery((theme) => theme.breakpoints.down('sm'));
  const titleId = useId();
  const stepsTitleId = useId();
  const isEdit = channel !== null;
  const form = useForm<SlackChannelFormValues>({
    resolver: zodResolver(isEdit ? editSlackChannelFormSchema : slackChannelConfigSchema),
    mode: 'onTouched',
    defaultValues: { name: channel?.destination ?? '', webhookUrl: '' },
  });
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = form;

  // Start fresh every time the dialog opens
  useEffect(() => {
    if (open) reset({ name: channel?.destination ?? '', webhookUrl: '' });
  }, [open, channel, reset]);

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
          {isEdit ? t('connect.editTitle') : t('connect.title')}
        </DialogTitle>
        <DialogContent className={styles.fields}>
          <Typography>{t('connect.intro')}</Typography>

          <section aria-labelledby={stepsTitleId}>
            <Typography variant="subtitle2" component="h3" id={stepsTitleId}>
              {t('connect.stepsTitle')}
            </Typography>
            <ol className={styles.steps}>
              <li>{t('connect.step1')}</li>
              <li>{t('connect.step2')}</li>
              <li>{t('connect.step3')}</li>
            </ol>
            <Link href={SLACK_WEBHOOKS_GUIDE_URL} target="_blank" rel="noopener noreferrer">
              {t('connect.guide')}
              <OpenInNewIcon
                fontSize="inherit"
                className={styles.linkIcon}
                aria-hidden="true"
              />{' '}
              <span className={styles.visuallyHidden}>{t('connect.newTab')}</span>
            </Link>
          </section>

          <FormTextField
            control={control}
            name="name"
            label={t('connect.name')}
            helperText={t('connect.nameHint')}
            autoComplete="off"
            required
          />
          <FormTextField
            control={control}
            name="webhookUrl"
            type="url"
            label={t('connect.webhookUrl')}
            helperText={isEdit ? t('connect.webhookUrlEditHint') : t('connect.webhookUrlHint')}
            autoComplete="off"
            spellCheck={false}
            required={!isEdit}
          />
          <Typography variant="body2" color="text.secondary">
            {t('connect.secret')}
          </Typography>

          {errors.root?.server && <Alert severity="error">{errors.root.server.message}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={close} disabled={isSubmitting}>
            {t('common:actions.cancel')}
          </Button>
          <Button type="submit" variant="contained" loading={isSubmitting}>
            {isEdit ? t('connect.save') : t('connect.submit')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
