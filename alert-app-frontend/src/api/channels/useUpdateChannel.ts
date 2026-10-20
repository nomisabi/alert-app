import type { UpdateChannelRequest } from '@alert-app/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getGetChannelsQueryKey, updateChannel } from '../generated/channels/channels';

/**
 * Edits a channel (PATCH /api/channels/:id, Slack only), then reloads the list. Only the sent
 * fields change; a new webhook URL gets the test message first.
 */
export function useUpdateChannel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, changes }: { id: string; changes: UpdateChannelRequest }) =>
      updateChannel(id, changes),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetChannelsQueryKey() }),
  });
}
