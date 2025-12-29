import AsyncStorage from '@react-native-async-storage/async-storage';

export class DebugLogger {
  private static instance: DebugLogger;
  private logs: Array<{ timestamp: string; level: string; message: string; data?: any }> = [];
  private maxLogs = 100;

  static getInstance(): DebugLogger {
    if (!DebugLogger.instance) {
      DebugLogger.instance = new DebugLogger();
    }
    return DebugLogger.instance;
  }

  log(level: 'INFO' | 'WARN' | 'ERROR', message: string, data?: any) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data
    };

    this.logs.push(logEntry);
    
    // Keep only the last maxLogs entries
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Console output with emojis
    const emoji = level === 'ERROR' ? '❌' : level === 'WARN' ? '⚠️' : 'ℹ️';
    console.log(`${emoji} [${level}] ${message}`, data ? data : '');
  }

  async getAuthStatus(): Promise<{
    isAuthenticated: boolean;
    hasCookies: boolean;
    hasVisitorData: boolean;
    cookieCount: number;
  }> {
    try {
      const cookies = await AsyncStorage.getItem('ytm_cookies');
      const visitorData = await AsyncStorage.getItem('ytm_visitor_data');
      
      const cookieCount = cookies ? cookies.split(';').length : 0;
      
      return {
        isAuthenticated: !!cookies,
        hasCookies: !!cookies,
        hasVisitorData: !!visitorData,
        cookieCount
      };
    } catch (error) {
      return {
        isAuthenticated: false,
        hasCookies: false,
        hasVisitorData: false,
        cookieCount: 0
      };
    }
  }

  async logPlaylistState(playlists: any[]) {
    const authStatus = await this.getAuthStatus();
    
    this.log('INFO', 'Current playlist state', {
      totalPlaylists: playlists.length,
      localPlaylists: playlists.filter(p => p.isLocal).length,
      remotePlaylists: playlists.filter(p => !p.isLocal).length,
      playlistsWithSongs: playlists.filter(p => p.songs && p.songs.length > 0).length,
      authStatus,
      playlists: playlists.map(p => ({
        id: p.id,
        title: p.title,
        isLocal: p.isLocal,
        songCount: p.songs?.length || 0
      }))
    });
  }

  getLogs(): Array<{ timestamp: string; level: string; message: string; data?: any }> {
    return [...this.logs];
  }

  clearLogs() {
    this.logs = [];
  }

  async exportLogs(): Promise<string> {
    const authStatus = await this.getAuthStatus();
    const exportData = {
      timestamp: new Date().toISOString(),
      authStatus,
      logs: this.logs
    };
    return JSON.stringify(exportData, null, 2);
  }
}

export const debugLogger = DebugLogger.getInstance();