import AddLinkIcon from '@mui/icons-material/AddLink';
import { Button, Card, CardActions, CardContent, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { ChannelIcon } from '../../global/components/ChannelIcon/ChannelIcon';
import type { SlackConnectCardProps } from '../../types/channels/channels';
import styles from './ChannelsPage.module.scss';

/** The Slack card while Slack isn't connected: same layout as a channel card, with "Connect Slack". */
export function SlackConnectCard({ onConnect }: SlackConnectCardProps) {
  const { t } = useTranslation('channels');

  return (
    <Card variant="outlined" className={styles.card}>
      <CardContent className={styles.cardContent}>
        <ChannelIcon type="slack" className={styles.icon} />
        <div className={styles.text}>
          <Typography variant="h6" component="h2">
            {t('types.slack')}
          </Typography>
          <Typography className={styles.destination} color="text.secondary">
            {t('connect.notConnected')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('connect.hint')}
          </Typography>
        </div>
      </CardContent>
      <CardActions className={styles.cardActions}>
        <Button variant="contained" startIcon={<AddLinkIcon />} onClick={onConnect}>
          {t('connect.button')}
        </Button>
      </CardActions>
    </Card>
  );
}
