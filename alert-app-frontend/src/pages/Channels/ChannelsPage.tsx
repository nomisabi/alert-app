import type { Channel } from '@alert-app/shared';
import { Alert, Button } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useChannels } from '../../api/channels/useChannels';
import { useSendChannelTest } from '../../api/channels/useSendChannelTest';
import { Loading } from '../../global/components/Loading/Loading';
import { PageLayout } from '../../global/components/PageLayout/PageLayout';
import { useNotify } from '../../global/hooks/useNotify';
import { ChannelCard } from './ChannelCard';
import styles from './ChannelsPage.module.scss';

export function ChannelsPage() {
  const { t } = useTranslation('channels');
  const notify = useNotify();
  const channels = useChannels();
  const sendTest = useSendChannelTest();

  // The server's message is already translated, e.g. "Please try again in 42 seconds."
  const send = (channel: Channel) =>
    sendTest.mutate(channel, {
      onSuccess: () => notify(t('notify.testSent', { destination: channel.destination })),
      onError: (error) => notify(error.message, 'error'),
    });

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
          {channels.data.items.map((channel) => (
            <li key={channel.id}>
              <ChannelCard
                channel={channel}
                isSending={sendTest.isPending && sendTest.variables.id === channel.id}
                onSendTest={send}
              />
            </li>
          ))}
        </ul>
      )}
    </PageLayout>
  );
}
