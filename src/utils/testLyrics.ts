// Test lyrics functionality
import { InnerTube } from '../api/innertube';

export const testLyrics = async (videoId: string) => {
  console.log('🎵 Testing lyrics for videoId:', videoId);
  
  try {
    const result = await InnerTube.getLyrics(videoId);
    console.log('✅ Lyrics result:', result);
    
    if (result && result.lines) {
      console.log('📝 Found', result.lines.length, 'lines of lyrics');
      console.log('📄 First few lines:', result.lines.slice(0, 3));
    } else {
      console.log('❌ No lyrics found');
    }
    
    return result;
  } catch (error) {
    console.log('💥 Lyrics error:', error);
    return null;
  }
};

// Test with a popular song
// testLyrics('dQw4w9WgXcQ'); // Never Gonna Give You Up