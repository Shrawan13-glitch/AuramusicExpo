import { InteractionManager, Platform } from 'react-native';

// Performance optimization utilities
export class PerformanceOptimizer {
  // Debounce function for search and other frequent operations
  static debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout;
    return (...args: Parameters<T>) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  }

  // Throttle function for scroll events
  static throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ): (...args: Parameters<T>) => void {
    let inThrottle: boolean;
    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), limit);
      }
    };
  }

  // Run after interactions to avoid blocking UI
  static runAfterInteractions(callback: () => void): void {
    InteractionManager.runAfterInteractions(callback);
  }

  // Optimize image loading
  static getOptimizedImageProps(uri: string) {
    return {
      source: { uri },
      resizeMode: 'cover' as const,
      ...(Platform.OS === 'android' && {
        fadeDuration: 0, // Disable fade animation on Android for better performance
      }),
      loadingIndicatorSource: require('../../assets/icon.png'),
    };
  }

  // FlatList optimization props
  static getFlatListOptimizationProps(itemHeight: number) {
    return {
      removeClippedSubviews: true,
      maxToRenderPerBatch: 10,
      windowSize: 10,
      initialNumToRender: 10,
      getItemLayout: (data: any, index: number) => ({
        length: itemHeight,
        offset: itemHeight * index,
        index,
      }),
    };
  }
}

// Navigation performance optimization
export const navigationOptions = {
  // Reduce animation duration for faster navigation
  transitionSpec: {
    open: {
      animation: 'timing',
      config: {
        duration: 200,
      },
    },
    close: {
      animation: 'timing',
      config: {
        duration: 200,
      },
    },
  },
  // Enable gesture handling optimization
  gestureEnabled: true,
  gestureResponseDistance: {
    horizontal: 50,
    vertical: 135,
  },
};

// Memory management utilities
export class MemoryManager {
  private static imageCache = new Map<string, string>();
  private static maxCacheSize = 50;

  static cacheImage(key: string, uri: string): void {
    if (this.imageCache.size >= this.maxCacheSize) {
      const firstKey = this.imageCache.keys().next().value;
      this.imageCache.delete(firstKey);
    }
    this.imageCache.set(key, uri);
  }

  static getCachedImage(key: string): string | undefined {
    return this.imageCache.get(key);
  }

  static clearCache(): void {
    this.imageCache.clear();
  }
}