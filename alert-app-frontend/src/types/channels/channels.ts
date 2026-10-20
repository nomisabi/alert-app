import type { Channel } from '@alert-app/shared';

export interface ChannelCardProps {
  channel: Channel;
  /** True while this channel's test message is being sent. */
  isSending: boolean;
  onSendTest: (channel: Channel) => void;
}
