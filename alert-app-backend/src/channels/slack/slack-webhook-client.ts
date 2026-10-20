import { Logger } from '@nestjs/common';
import { PermanentSendError } from '../../errors/permanent-send-error.js';
import type { SlackPayload } from './slack-messages.js';

/** Slack should answer within seconds; a request that hangs counts as failed (and is retried). */
export const SLACK_TIMEOUT_MS = 10_000;

/**
 * Posts a message to a Slack incoming webhook. An abstract class like EmailProvider: the
 * real one (FetchSlackWebhookClient) or the log (LogSlackWebhookClient, for tests).
 *
 * The webhook URL is a secret (anyone who has it can post to the channel), so it never goes
 * into an error message or the log.
 */
export abstract class SlackWebhookClient {
  /** Throws when posting fails: `PermanentSendError` when trying again can't help. */
  abstract post(webhookUrl: string, payload: SlackPayload): Promise<void>;
}

/**
 * Slack refused the message itself (4xx, e.g. 404 `no_service` = the webhook was removed,
 * 410 `channel_is_archived`, 403 `action_prohibited`): trying again gives the same answer.
 * 429 (too many messages) and 5xx (Slack has a problem) are temporary.
 */
function isPermanent(status: number): boolean {
  return status >= 400 && status < 500 && status !== 429;
}

/** Posts with `fetch` (https://docs.slack.dev/messaging/sending-messages-using-incoming-webhooks). */
export class FetchSlackWebhookClient extends SlackWebhookClient {
  async post(webhookUrl: string, payload: SlackPayload): Promise<void> {
    let response: Response;
    try {
      response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(SLACK_TIMEOUT_MS),
      });
    } catch (error) {
      // Network error or timeout: temporary. Our message has no URL; fetch's own error (the
      // cause) names at most the host (hooks.slack.com), never the secret path.
      const name = error instanceof Error ? error.name : 'Error';
      throw new Error(`Slack: the request failed (${name})`, { cause: error });
    }
    if (response.ok) return;

    // Slack answers errors with a short code as plain text, e.g. "no_service". Anything else
    // (a proxy's error page, ...) is left out: the error goes to the log and the database.
    const body = (await response.text().catch(() => '')).trim();
    const code = /^[a-z_]{1,60}$/.test(body) ? body : '';
    const text = `Slack: ${response.status} ${code}`.trim();
    throw isPermanent(response.status) ? new PermanentSendError(text) : new Error(text);
  }
}

/**
 * Used when SLACK_ENABLED=false (the e2e tests): writes the message to the log instead of
 * posting it, so tests never reach a real Slack channel.
 */
export class LogSlackWebhookClient extends SlackWebhookClient {
  private readonly logger = new Logger(LogSlackWebhookClient.name);

  post(_webhookUrl: string, payload: SlackPayload): Promise<void> {
    this.logger.log(`Slack message: "${payload.text}" (${payload.blocks.length} blocks)`);
    return Promise.resolve();
  }
}
