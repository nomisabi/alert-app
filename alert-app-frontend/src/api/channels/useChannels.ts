import { useGetChannels } from '../generated/channels/channels';

/**
 * The logged-in user's channels, oldest first (GET /api/channels).
 *
 * Reloaded every time the browser tab gets focus again (the app turns that off by default): the
 * alert dialog's "Connect Slack" link opens the Channels page in a new tab, so after connecting
 * Slack there, the "Send to" list shows it as soon as the user comes back.
 */
export function useChannels() {
  return useGetChannels({ query: { refetchOnWindowFocus: 'always' } });
}
