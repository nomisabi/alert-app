import type { ChannelType } from '@alert-app/shared';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import type { SvgIconProps } from '@mui/material';
import type { ComponentType } from 'react';

// Slack (milestone 7): MUI has no brand icons, so it gets its own SvgIcon.
const icons: Record<ChannelType, ComponentType<SvgIconProps>> = {
  email: EmailOutlinedIcon,
};

interface ChannelIconProps extends SvgIconProps {
  type: ChannelType;
}

/** The icon of a channel type. Decorative: put the channel's name next to it or in an aria-label. */
export function ChannelIcon({ type, ...props }: ChannelIconProps) {
  const Icon = icons[type];
  return <Icon aria-hidden="true" {...props} />;
}
