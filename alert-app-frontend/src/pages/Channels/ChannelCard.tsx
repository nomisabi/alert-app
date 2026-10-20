import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import SendIcon from '@mui/icons-material/Send';
import { Button, Card, CardActions, CardContent, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { ChannelIcon } from '../../global/components/ChannelIcon/ChannelIcon';
import type { ChannelCardProps } from '../../types/channels/channels';
import styles from './ChannelsPage.module.scss';

/** One channel: its type, where it sends to, "Send test message" and (for Slack) "Edit". */
export function ChannelCard({ channel, isSending, onSendTest, onEdit }: ChannelCardProps) {
  const { t } = useTranslation('channels');

  return (
    <Card variant="outlined" className={styles.card}>
      <CardContent className={styles.cardContent}>
        <ChannelIcon type={channel.type} className={styles.icon} />
        <div className={styles.text}>
          <Typography variant="h6" component="h2">
            {t(`types.${channel.type}`)}
          </Typography>
          {/* Long addresses wrap instead of pushing the card wider than a phone */}
          <Typography className={styles.destination}>{channel.destination}</Typography>
          <Typography variant="body2" color="text.secondary">
            {t(`hints.${channel.type}`)}
          </Typography>
        </div>
      </CardContent>
      <CardActions className={styles.cardActions}>
        <Button
          variant="outlined"
          startIcon={<SendIcon />}
          loading={isSending}
          onClick={() => onSendTest(channel)}
          // The visible text is the same on every card, so name the channel for screen readers
          aria-label={t('sendTestFor', {
            type: t(`types.${channel.type}`),
            destination: channel.destination,
          })}
        >
          {t('sendTest')}
        </Button>
        {onEdit && (
          <Button
            startIcon={<EditOutlinedIcon />}
            onClick={() => onEdit(channel)}
            aria-label={t('editFor', {
              type: t(`types.${channel.type}`),
              destination: channel.destination,
            })}
          >
            {t('edit')}
          </Button>
        )}
      </CardActions>
    </Card>
  );
}
