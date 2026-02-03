import { parseProfileData } from '../src/utils/profileParser';

export async function fetchProfile(channelId: string) {
  try {
    const response = await fetch('https://music.youtube.com/youtubei/v1/browse', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: 'WEB_REMIX',
            clientVersion: '1.20210621.00.00',
          },
        },
        browseId: channelId,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return parseProfileData(data);
  } catch (error) {
    console.error('Error fetching profile:', error);
    throw error;
  }
}