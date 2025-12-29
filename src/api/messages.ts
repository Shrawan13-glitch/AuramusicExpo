import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const MESSAGES_ENDPOINT = 'https://shrawan13-glitch.github.io/auramusic-messages/messages.json';

export interface Message {
  id: string;
  title: string;
  type: 'announcement' | 'update' | 'maintenance' | 'alert';
  date: string;
  url: string;
}

export interface MessagesResponse {
  messages: Message[];
}

class MessagesAPI {
  private static CACHE_KEY = 'cached_messages';
  private static READ_MESSAGES_KEY = 'read_messages';

  static async getMessages(): Promise<Message[]> {
    try {
      const response = await axios.get<MessagesResponse>(MESSAGES_ENDPOINT, {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      const messages = response.data.messages;
      
      // Cache messages
      await AsyncStorage.setItem(this.CACHE_KEY, JSON.stringify(messages));
      
      return messages;
    } catch (error) {
      // Return cached messages if network fails
      const cached = await AsyncStorage.getItem(this.CACHE_KEY);
      return cached ? JSON.parse(cached) : [];
    }
  }

  static async getMessageContent(url: string): Promise<string> {
    try {
      const response = await axios.get(url, {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      return response.data;
    } catch (error) {
      return 'Failed to load message content.';
    }
  }

  static async markAsRead(messageId: string): Promise<void> {
    const readMessages = await this.getReadMessages();
    if (!readMessages.includes(messageId)) {
      readMessages.push(messageId);
      await AsyncStorage.setItem(this.READ_MESSAGES_KEY, JSON.stringify(readMessages));
    }
  }

  static async getReadMessages(): Promise<string[]> {
    const stored = await AsyncStorage.getItem(this.READ_MESSAGES_KEY);
    return stored ? JSON.parse(stored) : [];
  }

  static async getUnreadCount(messages: Message[]): Promise<number> {
    const readMessages = await this.getReadMessages();
    return messages.filter(msg => !readMessages.includes(msg.id)).length;
  }
}

export default MessagesAPI;