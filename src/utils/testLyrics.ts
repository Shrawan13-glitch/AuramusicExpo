// Test lyrics functionality
import { InnerTube } from '../api/innertube';

export const testLyrics = async (videoId: string) => {
  
  
  try {
    const result = await InnerTube.getLyrics(videoId);
    
    
    if (result && result.lines) {
      
      
    } else {
      
    }
    
    return result;
  } catch (error) {
    
    return null;
  }
};

// Test with a popular song
// testLyrics('dQw4w9WgXcQ'); // Never Gonna Give You Up