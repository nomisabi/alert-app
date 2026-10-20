import type { Channel } from '@alert-app/shared';
import { Alert, Button } from '@mui/material';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useChannels } from '../../api/channels/useChannels';
import { useCreateChannel } from '../../api/channels/useCreateChannel';
import { useSendChannelTest } from '../../api/channels/useSendChannelTest';
import { useUpdateChannel } from '../../api/channels/useUpdateChannel';
import { Loading } from '../../global/components/Loading/Loading';
import { PageLayout } from '../../global/components/PageLayout/PageLayout';
import { useNotify } from '../../global/hooks/useNotify';
import type { SlackChannelFormValues } from '../../types/channels/channels';
import { ChannelCard } from './ChannelCard';
import styles from './ChannelsPage.module.scss';
import { SlackChannelDialog } from './SlackChannelDialog';
import { SlackConnectCard } from './SlackConnectCard';

export function ChannelsPage() {
  const { t } = useTranslation('channels');
  const notify = useNotify();
  const channels = useChannels();
  const sendTest = useSendChannelTest();
  // The Slack dialog: connecting (`channel: null`) or editing the Slack channel. The channel stays
  // while the dialog fades out, so its title doesn't change while closing.
  const [slackDialog, setSlackDialog] = useState<{ open: boolean; channel: Channel | null }>({
    open: false,
    channel: null,
  });
  const closeSlackDialog = () => setSlackDialog((dialog) => ({ ...dialog, open: false }));
  const createChannel = useCreateChannel();
  const updateChannel = useUpdateChannel();

  const items = channels.data?.items ?? [];
  // One Slack channel per user: until it's connected, its place shows "Connect Slack"
  const hasSlack = items.some((channel) => channel.type === 'slack');

  // The server's message is already translated, e.g. "Please try again in 42 seconds."
  const send = (channel: Channel) =>
    sendTest.mutate(channel, {
      onSuccess: () => notify(t('notify.testSent', { destination: channel.destination })),
      onError: (error) => notify(error.message, 'error'),
    });

  /**
   * Connect: POST /api/channels. Edit: PATCH with the name, and the URL only when a new one was
   * typed (empty = keep). A new URL gets the test message on the server first. Errors are thrown,
   * so the dialog shows them (e.g. under the URL field) and stays open.
   */
  const saveSlack = async ({ name, webhookUrl }: SlackChannelFormValues) => {
    const editing = slackDialog.channel;
    const channel = editing
      ? await updateChannel.mutateAsync({
          id: editing.id,
          changes: { name, ...(webhookUrl && { webhookUrl }) },
        })
      : await createChannel.mutateAsync({ type: 'slack', name, webhookUrl });
    closeSlackDialog();

    if (editing && !webhookUrl) {
      notify(t('notify.slackUpdated'));
    } else {
      const key = editing ? 'notify.slackUpdatedWithTest' : 'notify.slackConnected';
      notify(t(key, { destination: channel.destination }));
    }
  };

  return (
    <PageLayout title={t('title')} description={t('description')}>
      {channels.isPending && <Loading />}

      {channels.isError && (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => void channels.refetch()}>
              {t('retry')}
            </Button>
          }
        >
          {t('loadError')}
        </Alert>
      )}

      {/* Never empty: every user has their email channel */}
      {channels.isSuccess && (
        <ul className={styles.list} aria-label={t('listLabel')}>
          {items.map((channel) => (
            <li key={channel.id}>
              <ChannelCard
                channel={channel}
                isSending={sendTest.isPending && sendTest.variables.id === channel.id}
                onSendTest={send}
                onEdit={
                  channel.type === 'slack'
                    ? () => setSlackDialog({ open: true, channel })
                    : undefined
                }
              />
            </li>
          ))}
          {!hasSlack && (
            <li>
              <SlackConnectCard onConnect={() => setSlackDialog({ open: true, channel: null })} />
            </li>
          )}
        </ul>
      )}

      <SlackChannelDialog
        open={slackDialog.open}
        channel={slackDialog.channel}
        onSubmit={saveSlack}
        onClose={closeSlackDialog}
      />
    </PageLayout>
  );
}
