/**
 * Expo Push Notification sender.
 * Uses the Expo Push API: https://docs.expo.dev/push-notifications/sending-notifications/
 * No Firebase SDK required — works with Expo Go and standalone apps.
 */

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

export type ExpoPushMessage = {
  to: string | string[];
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default' | null;
  badge?: number;
  priority?: 'default' | 'normal' | 'high';
  channelId?: string;
};

export type ExpoPushTicket =
  | { status: 'ok'; id: string }
  | { status: 'error'; message: string; details?: { error?: string } };

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

function isExpoPushToken(token: string): boolean {
  return /^Expo(nentPushToken)?\[.+\]$/.test(token);
}

export async function sendPushNotifications(messages: ExpoPushMessage[]): Promise<void> {
  const validMessages = messages.filter((m) => {
    const tokens = Array.isArray(m.to) ? m.to : [m.to];
    return tokens.every(isExpoPushToken);
  });

  if (validMessages.length === 0) return;

  const chunks = chunkArray(validMessages, 100);

  for (const chunk of chunks) {
    try {
      await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(chunk),
      });
    } catch (err) {
      console.error('[push] Failed to send chunk:', err);
    }
  }
}
