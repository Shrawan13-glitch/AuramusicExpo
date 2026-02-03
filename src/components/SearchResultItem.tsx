import React, { useCallback, useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Text, useTheme, IconButton } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SearchResult } from '../../api/types';
import { useSongOptions } from '../contexts/SongOptionsContext';

interface SearchResultItemProps {
  item: SearchResult;
  onPress: () => void;
  onMenuPress?: () => void;
  navigation?: any;
}

const SearchResultItem = React.memo(({ item, onPress, onMenuPress, navigation }: SearchResultItemProps) => {
  const theme = useTheme();
  const { openSongOptions } = useSongOptions();

  const handlePress = useCallback(() => {
    if (item.type === 'artist' && navigation) {
      navigation.navigate('Artist', { 
        artistId: item.id, 
        artistName: item.title 
      });
    } else if (item.type === 'profile' && navigation) {
      navigation.navigate('Profile', { 
        profileData: {
          title: item.title,
          description: '',
          thumbnail: item.thumbnail,
          bannerThumbnail: '',
          subscriberCount: item.subscribers || '0',
          isSubscribed: false,
          channelId: item.id,
          sections: []
        }
      });
    } else {
      onPress();
    }
  }, [item, navigation, onPress]);

  const actionButton = useMemo(() => {
    const canOpenOptions = item.type === 'song' || item.type === 'video';
    const iconName = (() => {
      switch (item.type) {
        case 'album':
        case 'playlist':
          return 'plus';
        case 'artist':
        case 'profile':
        case 'podcast':
          return 'account-plus';
        default:
          return 'dots-vertical';
      }
    })();

    return (
      <IconButton
        icon={iconName}
        size={20}
        iconColor={theme.colors.onSurfaceVariant}
        onPress={() => {
          if (canOpenOptions) {
            openSongOptions({
              videoId: item.id,
              title: item.title,
              artist: item.artist,
              thumbnail: item.thumbnail,
            });
          } else if (onMenuPress) {
            onMenuPress();
          }
        }}
      />
    );
  }, [item.type, item.id, item.title, item.artist, item.thumbnail, onMenuPress, openSongOptions, theme.colors.onSurfaceVariant]);

  const typeIcon = useMemo(() => {
    switch (item.type) {
      case 'song': return 'music-note';
      case 'video': return 'play';
      case 'album': return 'album';
      case 'artist': return 'account-music';
      case 'playlist': return 'playlist-music';
      case 'episode': return 'microphone';
      case 'profile': return 'account';
      case 'podcast': return 'podcast';
      default: return 'music';
    }
  }, [item.type]);

  const subtitle = useMemo(() => {
    const parts = [];
    
    if (item.type) {
      parts.push(item.type.charAt(0).toUpperCase() + item.type.slice(1));
    }
    
    if (item.artist && item.artist !== 'Unknown Artist') {
      parts.push(item.artist);
    }
    
    if (item.year) {
      parts.push(item.year);
    }
    
    if (item.plays) {
      parts.push(item.plays);
    }
    
    if (item.subscribers) {
      parts.push(item.subscribers);
    }

    return parts.join(' • ');
  }, [item.type, item.artist, item.year, item.plays, item.subscribers]);

  return (
    <TouchableOpacity
      style={[styles.container, { borderBottomColor: theme.colors.outline }]}
      onPress={handlePress}
      onLongPress={() => {
        if (item.type === 'song' || item.type === 'video') {
          openSongOptions({
            videoId: item.id,
            title: item.title,
            artist: item.artist,
            thumbnail: item.thumbnail,
          });
        }
      }}
      activeOpacity={0.7}
    >
      <View style={styles.thumbnail}>
        {item.thumbnail ? (
          <Image 
            source={{ uri: item.thumbnail }} 
            style={[styles.thumbnailImage, { backgroundColor: theme.colors.surfaceVariant }]}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.thumbnailPlaceholder, { backgroundColor: theme.colors.surfaceVariant }]}>
            <MaterialCommunityIcons 
              name={typeIcon} 
              size={24} 
              color={theme.colors.onSurfaceVariant} 
            />
          </View>
        )}
      </View>
      
      <View style={styles.content}>
        <Text 
          variant="titleSmall" 
          numberOfLines={2}
          style={[styles.title, { color: theme.colors.onSurface }]}
        >
          {item.title}
        </Text>
        
        <Text 
          variant="bodySmall" 
          numberOfLines={2}
          style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}
        >
          {subtitle}
        </Text>
        
        {item.duration && (
          <Text 
            variant="bodySmall" 
            style={[styles.duration, { color: theme.colors.onSurfaceVariant }]}
          >
            {item.duration}
          </Text>
        )}
      </View>
      
      <View style={styles.actions}>
        {actionButton}
      </View>
    </TouchableOpacity>
  );
});

export default SearchResultItem;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
    minHeight: 72,
  },
  thumbnail: {
    marginRight: 16,
  },
  thumbnailImage: {
    width: 56,
    height: 56,
    borderRadius: 8,
  },
  thumbnailPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    gap: 2,
  },
  title: {
    fontWeight: '500',
    lineHeight: 20,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  duration: {
    fontSize: 12,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
});
