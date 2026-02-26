import AsyncStorage from '@react-native-async-storage/async-storage';

export type AppMessageType = 'update' | 'announcement' | 'alert';

export interface AppMessage {
  id: string;
  title: string;
  type: AppMessageType;
  date: string;
  url: string;
}

const MESSAGES_INDEX_URL = 'https://shrawan13-glitch.github.io/auramusic-messages/messages.json';
const INDEX_CACHE_KEY = 'messages_index_cache_v1';
const BODY_CACHE_PREFIX = 'message_body_cache_v1:';

const normalizeType = (value: string): AppMessageType => {
  const raw = value.trim().toLowerCase();
  if (raw === 'alert') return 'alert';
  if (raw === 'announcement' || raw === 'announcements') return 'announcement';
  return 'update';
};

const normalizeMessages = (input: unknown): AppMessage[] => {
  if (!Array.isArray(input)) return [];

  return input
    .map((item) => {
      const message = item as Partial<AppMessage>;
      if (!message?.id || !message?.title || !message?.date || !message?.url) {
        return null;
      }
      return {
        id: String(message.id),
        title: String(message.title),
        type: normalizeType(String(message.type ?? 'update')),
        date: String(message.date),
        url: String(message.url),
      } satisfies AppMessage;
    })
    .filter((value): value is AppMessage => !!value);
};

export const getCachedMessagesIndex = async (): Promise<AppMessage[]> => {
  try {
    const raw = await AsyncStorage.getItem(INDEX_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { messages?: AppMessage[] };
    return normalizeMessages(parsed?.messages ?? []);
  } catch (error) {
    console.warn('Failed to read cached messages index', error);
    return [];
  }
};

export const fetchMessagesIndex = async (): Promise<AppMessage[]> => {
  const response = await fetch(MESSAGES_INDEX_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch messages index (${response.status})`);
  }

  const parsed = (await response.json()) as { messages?: unknown[] };
  const normalized = normalizeMessages(parsed?.messages ?? []);
  await AsyncStorage.setItem(
    INDEX_CACHE_KEY,
    JSON.stringify({
      version: 1,
      updatedAt: Date.now(),
      messages: normalized,
    })
  );
  return normalized;
};

const bodyCacheKey = (url: string) => `${BODY_CACHE_PREFIX}${encodeURIComponent(url)}`;

export const getCachedMessageBody = async (url: string): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(bodyCacheKey(url));
  } catch (error) {
    console.warn('Failed to read cached message body', error);
    return null;
  }
};

export const fetchMessageBody = async (url: string): Promise<string> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch message body (${response.status})`);
  }
  const body = await response.text();
  await AsyncStorage.setItem(bodyCacheKey(url), body);
  return body;
};
