import type { CreateChannelRequest } from '@alert-app/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createChannel, getGetChannelsQueryKey } from '../generated/channels/channels';

/**
 * Connects a channel (POST /api/channels), then reloads the list (also used by "Send to" in the
 * alert dialog). Slack: the server sends the test message first and saves only if Slack accepts it.
 */
export function useCreateChannel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (channel: CreateChannelRequest) => createChannel(channel),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetChannelsQueryKey() }),
  });
}
