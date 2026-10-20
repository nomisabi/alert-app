import { useGetChannels } from '../generated/channels/channels';

/** The logged-in user's channels, oldest first (GET /api/channels). */
export function useChannels() {
  return useGetChannels();
}
