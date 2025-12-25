import AsyncStorage from '@react-native-async-storage/async-storage';
import { PlayHistory, Song, AuraStats } from '../types';

const HISTORY_KEY = 'play_history';
const BATCH_SIZE = 100;

export class AuraDB {
  static async addPlayHistory(song: Song, duration: number): Promise<void> {
    const genre = await this.detectGenre(song);
    const history: PlayHistory = {
      id: `${song.id}_${Date.now()}`,
      song,
      playedAt: Date.now(),
      duration,
      genre,
    };

    const data = await AsyncStorage.getItem(HISTORY_KEY);
    const existing: PlayHistory[] = data ? JSON.parse(data) : [];
    const histories = [history, ...existing];
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(histories.slice(0, 10000)));
  }

  static async getHistory(offset = 0, limit = 50): Promise<PlayHistory[]> {
    const data = await AsyncStorage.getItem(HISTORY_KEY);
    if (!data) return [];
    const all: PlayHistory[] = JSON.parse(data);
    return all.slice(offset, offset + limit);
  }

  static async getHistoryByDate(startDate: number, endDate: number): Promise<PlayHistory[]> {
    const data = await AsyncStorage.getItem(HISTORY_KEY);
    if (!data) return [];
    const all: PlayHistory[] = JSON.parse(data);
    return all.filter(h => h.playedAt >= startDate && h.playedAt <= endDate);
  }

  static async getAuraStats(): Promise<AuraStats> {
    const data = await AsyncStorage.getItem(HISTORY_KEY);
    if (!data) return { 
      totalListeningTime: 0, 
      genreBreakdown: {}, 
      topGenres: [], 
      topArtists: [],
      topSongs: [],
      auraScore: 0, 
      auraLevel: 'Common',
      nextRank: { name: 'Uncommon', pointsNeeded: 1000, emoji: '⭐' }
    };

    const all: PlayHistory[] = JSON.parse(data);
    const genreBreakdown: { [genre: string]: number } = {};
    const artistMap: { [id: string]: { id: string; name: string; playCount: number; time: number; thumbnail?: string } } = {};
    const songMap: { [id: string]: { song: Song; playCount: number; time: number } } = {};
    let totalTime = 0;

    all.forEach(h => {
      totalTime += h.duration;
      const genre = h.genre || 'Unknown';
      genreBreakdown[genre] = (genreBreakdown[genre] || 0) + h.duration;
      
      // Track artists
      h.song.artists.forEach(artist => {
        if (!artistMap[artist.id]) {
          artistMap[artist.id] = { id: artist.id, name: artist.name, playCount: 0, time: 0 };
        }
        artistMap[artist.id].playCount++;
        artistMap[artist.id].time += h.duration;
      });
      
      // Track songs
      if (!songMap[h.song.id]) {
        songMap[h.song.id] = { song: h.song, playCount: 0, time: 0 };
      }
      songMap[h.song.id].playCount++;
      songMap[h.song.id].time += h.duration;
    });

    const topGenres = Object.entries(genreBreakdown)
      .map(([genre, time]) => ({ genre, time, percentage: (time / totalTime) * 100 }))
      .sort((a, b) => b.time - a.time)
      .slice(0, 10);

    const topArtists = Object.values(artistMap)
      .sort((a, b) => b.time - a.time)
      .slice(0, 10);

    const topSongs = Object.values(songMap)
      .sort((a, b) => b.time - a.time)
      .slice(0, 10);

    const auraScore = this.calculateAuraScore(totalTime);
    const auraLevel = this.getAuraLevel(auraScore);
    const nextRank = this.getNextRank(auraScore);

    return { totalListeningTime: totalTime, genreBreakdown, topGenres, topArtists, topSongs, auraScore, auraLevel, nextRank };
  }

  static async clearHistory(): Promise<void> {
    await AsyncStorage.removeItem(HISTORY_KEY);
  }

  private static async detectGenre(song: Song): Promise<string> {
    const cacheKey = `genre_${song.id}`;
    const cached = await AsyncStorage.getItem(cacheKey);
    if (cached) return cached;

    // Try YouTube Music category first
    let genre = await this.tryYouTubeMusic(song.id);
    if (genre && genre !== 'Other') {
      await AsyncStorage.setItem(cacheKey, genre);
      return genre;
    }

    // Try multiple APIs in sequence
    genre = await this.tryLastFM(song);
    if (genre && genre !== 'Other') {
      await AsyncStorage.setItem(cacheKey, genre);
      return genre;
    }

    genre = await this.tryMusicBrainz(song);
    if (genre && genre !== 'Other') {
      await AsyncStorage.setItem(cacheKey, genre);
      return genre;
    }

    genre = await this.tryAudioDB(song);
    if (genre && genre !== 'Other') {
      await AsyncStorage.setItem(cacheKey, genre);
      return genre;
    }

    // Fallback to keyword detection
    genre = this.detectGenreByKeywords(song);
    await AsyncStorage.setItem(cacheKey, genre);
    return genre;
  }

  private static async tryYouTubeMusic(videoId: string): Promise<string | null> {
    try {
      const response = await fetch(
        `https://music.youtube.com/youtubei/v1/player?key=AIzaSyC9XL3ZjWddXya6X74dJoCTL-WEYFDNX30`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            context: {
              client: { clientName: 'WEB_REMIX', clientVersion: '1.20231122.01.00' }
            },
            videoId
          }),
          timeout: 3000
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        const category = data.videoDetails?.musicVideoType || data.videoDetails?.category;
        if (category) {
          return this.mapGenre(category);
        }
      }
    } catch (e) {}
    return null;
  }

  private static async tryLastFM(song: Song): Promise<string | null> {
    try {
      const artist = song.artists[0]?.name || '';
      const title = song.title;
      const response = await fetch(
        `https://ws.audioscrobbler.com/2.0/?method=track.getInfo&api_key=8de46d96ab6ecb8b77b26b8aae7072c9&artist=${encodeURIComponent(artist)}&track=${encodeURIComponent(title)}&format=json`,
        { timeout: 3000 }
      );
      
      if (response.ok) {
        const data = await response.json();
        const tags = data.track?.toptags?.tag || [];
        if (tags.length > 0) {
          const topTag = tags[0].name;
          return this.mapGenre(topTag);
        }
      }
    } catch (e) {}
    return null;
  }

  private static async tryMusicBrainz(song: Song): Promise<string | null> {
    try {
      const artist = song.artists[0]?.name || '';
      const title = song.title;
      const response = await fetch(
        `https://musicbrainz.org/ws/2/recording/?query=artist:${encodeURIComponent(artist)}%20AND%20recording:${encodeURIComponent(title)}&fmt=json&limit=1`,
        { headers: { 'User-Agent': 'AuraMusic/1.0' }, timeout: 3000 }
      );
      
      if (response.ok) {
        const data = await response.json();
        const tags = data.recordings?.[0]?.tags || [];
        if (tags.length > 0) {
          const topTag = tags[0].name;
          return this.mapGenre(topTag);
        }
      }
    } catch (e) {}
    return null;
  }

  private static async tryAudioDB(song: Song): Promise<string | null> {
    try {
      const artist = song.artists[0]?.name || '';
      const response = await fetch(
        `https://www.theaudiodb.com/api/v1/json/2/search.php?s=${encodeURIComponent(artist)}`,
        { timeout: 3000 }
      );
      
      if (response.ok) {
        const data = await response.json();
        const artistData = data.artists?.[0];
        if (artistData?.strGenre) {
          return this.mapGenre(artistData.strGenre);
        }
      }
    } catch (e) {}
    return null;
  }

  private static mapGenre(tag: string): string {
    const lower = tag.toLowerCase();
    if (/(phonk|drift)/i.test(lower)) return 'Phonk';
    if (/(punjabi|bhangra)/i.test(lower)) return 'Punjabi';
    if (/(haryanvi)/i.test(lower)) return 'Haryanvi';
    if (/(bollywood|hindi|filmi|indian)/i.test(lower)) return 'Bollywood';
    if (/(trap)/i.test(lower)) return 'Trap';
    if (/(edm|electronic|house|techno|dubstep|dance)/i.test(lower)) return 'EDM';
    if (/(lo-fi|lofi|chillhop|chill)/i.test(lower)) return 'Lo-Fi';
    if (/(hip hop|hip-hop|rap)/i.test(lower)) return 'Hip Hop';
    if (/(rock|metal|punk|hard rock|alternative rock)/i.test(lower)) return 'Rock';
    if (/(pop|synth-pop|electropop)/i.test(lower)) return 'Pop';
    if (/(r&b|rnb|rhythm and blues|soul)/i.test(lower)) return 'R&B';
    if (/(latin|reggaeton|salsa|bachata)/i.test(lower)) return 'Latin';
    if (/(jazz|bebop|swing)/i.test(lower)) return 'Jazz';
    if (/(classical|baroque|romantic)/i.test(lower)) return 'Classical';
    if (/(indie|alternative|indie rock|indie pop)/i.test(lower)) return 'Indie';
    if (/(country|folk|americana)/i.test(lower)) return 'Country';
    if (/(reggae|dancehall|ska)/i.test(lower)) return 'Reggae';
    if (/(k-pop|kpop|korean)/i.test(lower)) return 'K-Pop';
    if (/(anime|j-pop|jpop|japanese)/i.test(lower)) return 'Anime';
    return 'Other';
  }

  private static detectGenreByKeywords(song: Song): string {
    const title = song.title.toLowerCase();
    const artists = song.artists.map(a => a.name.toLowerCase()).join(' ');
    const text = `${title} ${artists}`;

    // Phonk
    if (/(phonk|drift|cowbell|brazilian|aggressive)/i.test(text)) return 'Phonk';
    
    // Indian Regional - Punjabi
    if (/(punjabi|sidhu|moose|wala|karan|aujla|diljit|dosanjh|ap dhillon|shubh|badshah|yo yo|honey singh|divine|raftaar|emiway|bantai|ikka|kr\$na|seedhe|munde)/i.test(text)) return 'Punjabi';
    
    // Indian Regional - Haryanvi  
    if (/(haryanvi|sapna|choudhary|masoom|sharma|gulzaar|chhaniwala|khasa|aala|raju|punjabi)/i.test(text)) return 'Haryanvi';
    
    // Bollywood/Hindi
    if (/(bollywood|hindi|arijit|singh|shreya|ghoshal|kumar|sanu|alka|yagnik|udit|narayan|kishore|lata|mangeshkar|asha|bhosle|vishal|shekhar|pritam|a\.r\.|rahman|badshah|neha|kakkar|tony|kakkar|jubin|nautiyal|armaan|malik|darshan|raval|atif|aslam)/i.test(text)) return 'Bollywood';
    
    // Trap
    if (/(trap|bass|808|migos|future|travis scott|lil|young thug|21 savage|playboi carti|gunna)/i.test(text)) return 'Trap';
    
    // EDM
    if (/(edm|electronic|house|techno|dubstep|skrillex|marshmello|avicii|calvin harris|martin garrix|kygo|alan walker|tiesto|david guetta|zedd|diplo|dj snake)/i.test(text)) return 'EDM';
    
    // Lo-Fi
    if (/(lofi|lo-fi|chill|study|beats to|jazzhop|chillhop)/i.test(text)) return 'Lo-Fi';
    
    // Hip Hop & Rap
    if (/(hip hop|rap|rapper|eminem|drake|kendrick|lamar|j cole|kanye|west|tupac|biggie|nas|jay-z|snoop|dogg|ice cube|dr dre|50 cent|nicki|minaj|cardi b|megan thee)/i.test(text)) return 'Hip Hop';
    
    // Rock & Metal
    if (/(rock|metal|punk|metallica|nirvana|linkin park|green day|foo fighters|ac\/dc|led zeppelin|pink floyd|queen|guns n|roses|iron maiden|slipknot|system of a down)/i.test(text)) return 'Rock';
    
    // Pop
    if (/(pop|taylor|swift|ariana|grande|bieber|justin|selena|gomez|dua lipa|billie|eilish|ed sheeran|weeknd|abel|shawn mendes|camila|cabello|miley|cyrus|katy perry|lady gaga)/i.test(text)) return 'Pop';
    
    // R&B
    if (/(r&b|rnb|rhythm|blues|usher|chris brown|beyonce|rihanna|frank ocean|sza|jhene|aiko|bryson tiller|partynextdoor|6lack)/i.test(text)) return 'R&B';
    
    // Latin
    if (/(latin|reggaeton|salsa|bachata|bad bunny|j balvin|daddy yankee|ozuna|maluma|karol g|anuel|shakira|luis fonsi)/i.test(text)) return 'Latin';
    
    // Jazz
    if (/(jazz|blues|soul|miles davis|coltrane|ella|fitzgerald|louis armstrong|billie holiday|nina simone)/i.test(text)) return 'Jazz';
    
    // Classical
    if (/(classical|orchestra|symphony|concerto|sonata|mozart|beethoven|bach|chopin|tchaikovsky|vivaldi)/i.test(text)) return 'Classical';
    
    // Indie & Alternative
    if (/(indie|alternative|arctic monkeys|tame impala|vampire weekend|the strokes|cage the elephant|mgmt|foster the people)/i.test(text)) return 'Indie';
    
    // Country
    if (/(country|folk|bluegrass|johnny cash|dolly parton|luke bryan|blake shelton|carrie underwood|keith urban)/i.test(text)) return 'Country';
    
    // Reggae
    if (/(reggae|dancehall|bob marley|damian|marley|sean paul|shaggy|beenie man)/i.test(text)) return 'Reggae';
    
    // K-Pop
    if (/(kpop|k-pop|bts|blackpink|twice|exo|seventeen|stray kids|txt|itzy|aespa)/i.test(text)) return 'K-Pop';
    
    // Anime/J-Pop
    if (/(anime|jpop|j-pop|opening|ending|ost|yoasobi|kenshi|yonezu|lisa|ado)/i.test(text)) return 'Anime';
    
    return 'Other';
  }

  private static calculateAuraScore(totalTime: number): number {
    const minutes = totalTime / (1000 * 60);
    return Math.round(minutes * 10);
  }

  private static getAuraLevel(score: number): string {
    if (score >= 50000) return 'Legendary';
    if (score >= 25000) return 'Mythic';
    if (score >= 10000) return 'Epic';
    if (score >= 5000) return 'Rare';
    if (score >= 1000) return 'Uncommon';
    return 'Common';
  }

  private static getNextRank(score: number): { name: string; pointsNeeded: number; emoji: string } | null {
    const ranks = [
      { name: 'Uncommon', threshold: 1000, emoji: '⭐' },
      { name: 'Rare', threshold: 5000, emoji: '💎' },
      { name: 'Epic', threshold: 10000, emoji: '⚡' },
      { name: 'Mythic', threshold: 25000, emoji: '🔮' },
      { name: 'Legendary', threshold: 50000, emoji: '👑' },
    ];

    for (const rank of ranks) {
      if (score < rank.threshold) {
        return { name: rank.name, pointsNeeded: rank.threshold - score, emoji: rank.emoji };
      }
    }
    return null;
  }
}
