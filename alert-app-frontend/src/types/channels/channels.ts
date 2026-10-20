import type { Channel, EditSlackChannelFormValues } from '@alert-app/shared';

export interface ChannelCardProps {
  channel: Channel;
  /** True while this channel's test message is being sent. */
  isSending: boolean;
  onSendTest: (channel: Channel) => void;
  /** Set for channels that can be edited (Slack): shows an "Edit" button. */
  onEdit?: (channel: Channel) => void;
}

export interface SlackConnectCardProps {
  onConnect: () => void;
}

/**
 * The "Connect Slack" / "Edit Slack" form. When editing, an empty `webhookUrl` keeps the current one.
 * Inferred from the shared schema (both forms have the same fields), so it can't drift from it.
 */
export type SlackChannelFormValues = EditSlackChannelFormValues;

export interface SlackChannelDialogProps {
  open: boolean;
  /** The Slack channel to edit, or `null` to connect Slack. */
  channel: Channel | null;
  /** Throws an `ApiRequestError` when the server rejects it (shown in the form). */
  onSubmit: (values: SlackChannelFormValues) => Promise<void>;
  onClose: () => void;
}
