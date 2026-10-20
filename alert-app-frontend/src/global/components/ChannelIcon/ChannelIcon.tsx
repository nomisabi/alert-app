import type { ChannelType } from '@alert-app/shared';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import type { SvgIconProps } from '@mui/material';
import type { ComponentType } from 'react';
import { SlackIcon } from './SlackIcon';

const icons: Record<ChannelType, ComponentType<SvgIconProps>> = {
  email: EmailOutlinedIcon,
  slack: SlackIcon,
};

interface ChannelIconProps extends SvgIconProps {
  type: ChannelType;
}

/** The icon of a channel type. Decorative: put the channel's name next to it or in an aria-label. */
export function ChannelIcon({ type, ...props }: ChannelIconProps) {
  const Icon = icons[type];
  return <Icon aria-hidden="true" {...props} />;
}
