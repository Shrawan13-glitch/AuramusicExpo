import { Platform } from 'react-native';

interface PerformanceMetrics {
  renderTime: number;
  navigationTime: number;
  searchTime: number;
  timestamp: number;
}

export class PerformanceMonitor {
  private static metrics: PerformanceMetrics[] = [];
  private static maxMetrics = 100;

  // Track render performance
  static trackRender(componentName: string, startTime: number): void {
    const endTime = Date.now();
    const renderTime = endTime - startTime;
    
    if (__DEV__) {
      console.log(`[Performance] ${componentName} render time: ${renderTime}ms`);
      
      if (renderTime > 16) { // 60fps = 16.67ms per frame
        console.warn(`[Performance Warning] ${componentName} render took ${renderTime}ms (>16ms)`);
      }
    }
    
    this.addMetric({
      renderTime,
      navigationTime: 0,
      searchTime: 0,
      timestamp: Date.now(),
    });
  }

  // Track navigation performance
  static trackNavigation(screenName: string, startTime: number): void {
    const endTime = Date.now();
    const navigationTime = endTime - startTime;
    
    if (__DEV__) {
      console.log(`[Performance] Navigation to ${screenName}: ${navigationTime}ms`);
      
      if (navigationTime > 300) {
        console.warn(`[Performance Warning] Navigation to ${screenName} took ${navigationTime}ms (>300ms)`);
      }
    }
    
    this.addMetric({
      renderTime: 0,
      navigationTime,
      searchTime: 0,
      timestamp: Date.now(),
    });
  }

  // Track search performance
  static trackSearch(query: string, startTime: number): void {
    const endTime = Date.now();
    const searchTime = endTime - startTime;
    
    if (__DEV__) {
      console.log(`[Performance] Search "${query}": ${searchTime}ms`);
      
      if (searchTime > 1000) {
        console.warn(`[Performance Warning] Search took ${searchTime}ms (>1000ms)`);
      }
    }
    
    this.addMetric({
      renderTime: 0,
      navigationTime: 0,
      searchTime,
      timestamp: Date.now(),
    });
  }

  // Add metric to collection
  private static addMetric(metric: PerformanceMetrics): void {
    if (this.metrics.length >= this.maxMetrics) {
      this.metrics.shift(); // Remove oldest metric
    }
    this.metrics.push(metric);
  }

  // Get performance summary
  static getPerformanceSummary(): {
    avgRenderTime: number;
    avgNavigationTime: number;
    avgSearchTime: number;
    totalMetrics: number;
  } {
    if (this.metrics.length === 0) {
      return {
        avgRenderTime: 0,
        avgNavigationTime: 0,
        avgSearchTime: 0,
        totalMetrics: 0,
      };
    }

    const renderTimes = this.metrics.filter(m => m.renderTime > 0).map(m => m.renderTime);
    const navigationTimes = this.metrics.filter(m => m.navigationTime > 0).map(m => m.navigationTime);
    const searchTimes = this.metrics.filter(m => m.searchTime > 0).map(m => m.searchTime);

    return {
      avgRenderTime: renderTimes.length > 0 ? renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length : 0,
      avgNavigationTime: navigationTimes.length > 0 ? navigationTimes.reduce((a, b) => a + b, 0) / navigationTimes.length : 0,
      avgSearchTime: searchTimes.length > 0 ? searchTimes.reduce((a, b) => a + b, 0) / searchTimes.length : 0,
      totalMetrics: this.metrics.length,
    };
  }

  // Clear all metrics
  static clearMetrics(): void {
    this.metrics = [];
  }

  // Log performance summary (development only)
  static logSummary(): void {
    if (__DEV__) {
      const summary = this.getPerformanceSummary();
      console.log('[Performance Summary]', summary);
    }
  }
}

// React hook for tracking component render performance
export function usePerformanceTracking(componentName: string): void {
  const startTime = Date.now();
  
  React.useEffect(() => {
    PerformanceMonitor.trackRender(componentName, startTime);
  });
}

// HOC for automatic performance tracking
export function withPerformanceTracking<P extends object>(
  Component: React.ComponentType<P>,
  componentName: string
): React.ComponentType<P> {
  return React.memo((props: P) => {
    const startTime = Date.now();
    
    React.useEffect(() => {
      PerformanceMonitor.trackRender(componentName, startTime);
    });
    
    return <Component {...props} />;
  });
}