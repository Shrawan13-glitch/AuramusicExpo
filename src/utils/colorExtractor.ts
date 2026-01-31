// Simple color extraction utility for ambient effects
export const extractDominantColor = (imageUrl: string): Promise<string> => {
  return new Promise((resolve) => {
    // Fallback colors based on image URL hash for consistent results
    const fallbackColors = [
      '#ff6b6b', '#4ecdc4', '#45b7d1', '#f39c12', 
      '#9b59b6', '#e74c3c', '#1db954', '#ff9f43'
    ];
    
    if (!imageUrl) {
      resolve('#1db954');
      return;
    }
    
    // Generate consistent color based on URL
    let hash = 0;
    for (let i = 0; i < imageUrl.length; i++) {
      const char = imageUrl.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    
    const colorIndex = Math.abs(hash) % fallbackColors.length;
    resolve(fallbackColors[colorIndex]);
  });
};

export const getTimeBasedColor = (): string => {
  const hour = new Date().getHours();
  
  if (hour >= 5 && hour < 12) {
    // Morning - warm oranges/yellows
    return '#f39c12';
  } else if (hour >= 12 && hour < 17) {
    // Afternoon - bright blues
    return '#45b7d1';
  } else if (hour >= 17 && hour < 21) {
    // Evening - purples/magentas
    return '#9b59b6';
  } else {
    // Night - deep blues/greens
    return '#1db954';
  }
};