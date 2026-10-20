import type { Channel } from '@alert-app/shared';
import { useMutation } from '@tanstack/react-query';
import { sendChannelTest } from '../generated/channels/channels';

/**
 * Sends a test message to a channel (POST /api/channels/:id/test).
 * At most one per channel per minute: a second one fails with the server's "try again in N seconds".
 */
export function useSendChannelTest() {
  return useMutation({
    // The whole channel, so the page can name it in the message
    mutationFn: (channel: Channel) => sendChannelTest(channel.id),
  });
}
