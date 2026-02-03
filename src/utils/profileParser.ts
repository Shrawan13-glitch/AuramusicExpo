interface YTMusicProfileResponse {
  header: {
    musicVisualHeaderRenderer: {
      title: { runs: Array<{ text: string }> };
      subscriptionButton: {
        subscribeButtonRenderer: {
          subscriberCountText: { runs: Array<{ text: string }> };
          subscribed: boolean;
          channelId: string;
        };
      };
      thumbnail: {
        musicThumbnailRenderer: {
          thumbnail: { thumbnails: Array<{ url: string; width: number; height: number }> };
        };
      };
      foregroundThumbnail: {
        musicThumbnailRenderer: {
          thumbnail: { thumbnails: Array<{ url: string; width: number; height: number }> };
        };
      };
    };
  };
  contents: {
    singleColumnBrowseResultsRenderer: {
      tabs: Array<{
        tabRenderer: {
          content: {
            sectionListRenderer: {
              contents: Array<{
                musicCarouselShelfRenderer?: {
                  header: {
                    musicCarouselShelfBasicHeaderRenderer: {
                      title: { runs: Array<{ text: string }> };
                    };
                  };
                  contents: Array<{
                    musicTwoRowItemRenderer: {
                      thumbnailRenderer: {
                        musicThumbnailRenderer: {
                          thumbnail: { thumbnails: Array<{ url: string }> };
                        };
                      };
                      title: { runs: Array<{ text: string }> };
                      subtitle?: { runs: Array<{ text: string }> };
                      navigationEndpoint?: {
                        browseEndpoint?: { browseId: string };
                        watchEndpoint?: { videoId: string };
                      };
                    };
                  }>;
                };
              }>;
            };
          };
        };
      }>;
    };
  };
  microformat: {
    microformatDataRenderer: {
      title: string;
      description: string;
    };
  };
}

export function parseProfileData(response: YTMusicProfileResponse) {
  const header = response.header?.musicVisualHeaderRenderer;
  const microformat = response.microformat?.microformatDataRenderer;
  
  if (!header) {
    throw new Error('Invalid profile response format');
  }

  // Extract basic profile info
  const title = header.title?.runs?.[0]?.text || microformat?.title || 'Unknown Artist';
  const description = microformat?.description || '';
  
  // Extract thumbnails
  const avatarThumbnails = header.foregroundThumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails || [];
  const bannerThumbnails = header.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails || [];
  
  const avatar = avatarThumbnails.length > 0 
    ? avatarThumbnails[avatarThumbnails.length - 1].url 
    : '';
  
  const banner = bannerThumbnails.length > 0 
    ? bannerThumbnails[bannerThumbnails.length - 1].url 
    : '';

  // Extract subscription info
  const subscriptionButton = header.subscriptionButton?.subscribeButtonRenderer;
  const subscriberCount = subscriptionButton?.subscriberCountText?.runs?.[0]?.text || '0';
  const isSubscribed = subscriptionButton?.subscribed || false;
  const channelId = subscriptionButton?.channelId || '';

  // Extract content sections
  const sections: Array<{ title: string; items: any[] }> = [];
  
  const contents = response.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents || [];
  
  contents.forEach((section) => {
    const carousel = section.musicCarouselShelfRenderer;
    if (carousel) {
      const sectionTitle = carousel.header?.musicCarouselShelfBasicHeaderRenderer?.title?.runs?.[0]?.text || 'Content';
      const items = carousel.contents?.map((item) => {
        const renderer = item.musicTwoRowItemRenderer;
        if (!renderer) return null;

        const itemTitle = renderer.title?.runs?.[0]?.text || '';
        const itemSubtitle = renderer.subtitle?.runs?.map(run => run.text).join('') || '';
        const itemThumbnails = renderer.thumbnailRenderer?.musicThumbnailRenderer?.thumbnail?.thumbnails || [];
        const itemThumbnail = itemThumbnails.length > 0 ? itemThumbnails[0].url : '';
        
        // Determine item type and ID
        let itemType = 'video';
        let itemId = '';
        
        if (renderer.navigationEndpoint?.browseEndpoint) {
          const browseId = renderer.navigationEndpoint.browseEndpoint.browseId;
          if (browseId.startsWith('MPLA')) {
            itemType = 'playlist';
          } else if (browseId.startsWith('MPREb_')) {
            itemType = 'album';
          } else if (browseId.startsWith('UC')) {
            itemType = 'artist';
          }
          itemId = browseId;
        } else if (renderer.navigationEndpoint?.watchEndpoint) {
          itemType = 'video';
          itemId = renderer.navigationEndpoint.watchEndpoint.videoId;
        }

        return {
          id: itemId,
          title: itemTitle,
          subtitle: itemSubtitle,
          thumbnail: itemThumbnail,
          type: itemType,
        };
      }).filter(Boolean) || [];

      if (items.length > 0) {
        sections.push({
          title: sectionTitle,
          items,
        });
      }
    }
  });

  return {
    title,
    description,
    thumbnail: avatar,
    bannerThumbnail: banner,
    subscriberCount,
    isSubscribed,
    channelId,
    sections,
  };
}

export function createMockProfileData() {
  return {
    title: "RUTHLESS PHONK",
    description: "This channel is dedicated to relaxed, aesthetic phonk — soft 808s, subtle cowbells, and calm underground energy.\nNo chaos. No noise. Just music for night drives, headphones, studying, zoning out, and peaceful moments.\nEvery track here is made to slow things down.\nPlay it low. Feel it deep.\n🌙 New uploads regularly\n🎧 Best experienced with headphones\n🖤 For listeners who prefer vibes over volume",
    thumbnail: "https://yt3.googleusercontent.com/MSYsO8sqo6xAROngBfbWtXPyw7UDuuhqQshQb2HhqXWffo6IFJ7Ko6VWQATy7ccxBSl9Phy6dfE=w544-c-h544-k-c0x00ffffff-no-l90-rj",
    bannerThumbnail: "https://yt3.googleusercontent.com/JSjoR7tnVCAWo3v1XyiZREvKG6UEhDQTh_SWlnM1TN5MiT6eR90ZafarGxTMkdDcw1PGw6jydw=w2048-h853-p-l90-rj",
    subscriberCount: "24",
    isSubscribed: false,
    channelId: "UCG8Rlcw5HU4tjnqyJJ--e5w",
    sections: [
      {
        title: "Videos",
        items: [
          {
            id: "2kfNoyCJfpg",
            title: "#TikiTiki#TikiTikiPhonk#Phonk#PhonkMusic#DriftPhonk#BassBoosted#ViralPhonk#GymPhonk#CarPhonk#",
            subtitle: "RUTHLESS PHONK • 2 views",
            thumbnail: "https://i.ytimg.com/vi/2kfNoyCJfpg/hq720.jpg?sqp=-oaymwEXCKAGEMIDIAQqCwjVARCqCBh4INgESFo&rs=AMzJL3lKBiuhsFF3tbPP9NxcaAGZCPNgFA",
            type: "video",
            views: "2 views"
          }
        ]
      }
    ]
  };
}