import {
  Checkbox,
  FormControl,
  FormControlLabel,
  FormGroup,
  FormHelperText,
  FormLabel,
} from '@mui/material';
import { useId } from 'react';
import { useController } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { fieldErrorText } from '../../global/utils/fieldError';
import type { ChannelsFieldProps } from '../../types/alert-rules/alertRules';

/** "Send to": one checkbox per channel of the user. At least one must be ticked. */
export function ChannelsField({ control, channels }: ChannelsFieldProps) {
  const { t } = useTranslation(['alerts', 'channels']);
  const helperTextId = useId();
  const {
    field: { ref, value, onChange, onBlur },
    fieldState: { error },
  } = useController({ control, name: 'channelIds' });

  // Keeps the ids in the order of the channel list, whatever order they were ticked in
  const toggle = (channelId: string, checked: boolean) =>
    onChange(
      channels
        .map((channel) => channel.id)
        .filter((id) => (id === channelId ? checked : value.includes(id))),
    );

  return (
    <FormControl component="fieldset" error={Boolean(error)} required>
      <FormLabel component="legend">{t('dialog.channels')}</FormLabel>
      <FormGroup aria-describedby={helperTextId}>
        {channels.map((channel, index) => (
          <FormControlLabel
            key={channel.id}
            label={t('dialog.channelOption', {
              type: t(`channels:types.${channel.type}`),
              destination: channel.destination,
            })}
            control={
              <Checkbox
                checked={value.includes(channel.id)}
                onChange={(event) => toggle(channel.id, event.target.checked)}
                onBlur={onBlur}
                // On submit with an error, React Hook Form focuses the first checkbox
                slotProps={{ input: { ref: index === 0 ? ref : undefined } }}
              />
            }
          />
        ))}
      </FormGroup>
      {/* aria-live: screen readers read out the error when it appears */}
      <FormHelperText id={helperTextId} aria-live="polite">
        {fieldErrorText(error) ?? t('dialog.channelsHint')}
      </FormHelperText>
    </FormControl>
  );
}
