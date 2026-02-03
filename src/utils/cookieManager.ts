import AsyncStorage from '@react-native-async-storage/async-storage';

export interface AuthCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires?: string;
}

export class CookieManager {
  private static readonly COOKIES_KEY = 'youtube_music_cookies';
  
  static async saveCookies(cookies: AuthCookie[]): Promise<void> {
    try {
      await AsyncStorage.setItem(this.COOKIES_KEY, JSON.stringify(cookies));
    } catch (error) {
      console.error('Failed to save cookies:', error);
    }
  }
  
  static async getCookies(): Promise<AuthCookie[]> {
    try {
      const cookiesJson = await AsyncStorage.getItem(this.COOKIES_KEY);
      return cookiesJson ? JSON.parse(cookiesJson) : [];
    } catch (error) {
      console.error('Failed to get cookies:', error);
      return [];
    }
  }
  
  static async clearCookies(): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.COOKIES_KEY);
    } catch (error) {
      console.error('Failed to clear cookies:', error);
    }
  }
  
  static formatCookiesForRequest(cookies: AuthCookie[]): string {
    return cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
  }
  
  static extractImportantCookies(cookies: AuthCookie[]): AuthCookie[] {
    const importantCookieNames = [
      'SAPISID',
      'APISID', 
      'SSID',
      'SID',
      'HSID',
      '__Secure-3PAPISID',
      '__Secure-3PSID',
      'LOGIN_INFO',
      'VISITOR_INFO1_LIVE'
    ];
    
    return cookies.filter(cookie => 
      importantCookieNames.some(name => 
        cookie.name.includes(name) || cookie.name.startsWith('__')
      )
    );
  }
}