import React from 'react';
import { View, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Text, useTheme, IconButton } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface ArtistCardProps {
  id: string;
  title: string;
  subtitle?: string;
  thumbnail: string;
  type: string;
  onPress: () => void;
  onMenuPress?: () => void;
  onLongPress?: () => void;
  variant?: 'list' | 'grid';
  navigation?: any;
}

export default function ArtistCard({ 
  id,
  title, 
  subtitle, 
  thumbnail, 
  type, 
  onPress, 
  onMenuPress,
  onLongPress,
  variant = 'list',
  navigation 
}: ArtistCardProps) {
  const theme = useTheme();

  const getTypeIcon = () => {
    switch (type) {
      case 'song': return 'music-note';
      case 'video': return 'play';
      case 'album': return 'album';
      case 'artist': return 'account-music';
      case 'playlist': return 'playlist-music';
      default: return 'music';
    }
  };

  if (variant === 'grid') {
    return (
      <TouchableOpacity style={styles.gridItem} onPress={onPress} onLongPress={onLongPress}>
        <View style={styles.gridThumbnailContainer}>
          {thumbnail ? (
            <Image 
              source={{ uri: thumbnail }} 
              style={[
                styles.gridThumbnail, 
                type === 'artist' && styles.circularThumbnail,
                { backgroundColor: theme.colors.surfaceVariant }
              ]} 
            />
          ) : (
            <View style={[
              styles.gridThumbnail, 
              type === 'artist' && styles.circularThumbnail,
              styles.thumbnailPlaceholder, 
              { backgroundColor: theme.colors.surfaceVariant }
            ]}>
              <MaterialCommunityIcons 
                name={getTypeIcon()} 
                size={32} 
                color={theme.colors.onSurfaceVariant} 
              />
            </View>
          )}
        </View>
        <Text 
          variant="titleSmall" 
          numberOfLines={2} 
          style={[styles.gridTitle, { color: theme.colors.onSurface }]}
        >
          {title}
        </Text>
        {subtitle && (
          <Text 
            variant="bodySmall" 
            numberOfLines={2} 
            style={[styles.gridSubtitle, { color: theme.colors.onSurfaceVariant }]}
          >
            {subtitle}
          </Text>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.listItem, { borderBottomColor: theme.colors.outline }]}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
    >
      <View style={styles.thumbnail}>
        {thumbnail ? (
          <Image 
            source={{ uri: thumbnail }} 
            style={[
              styles.thumbnailImage, 
              type === 'artist' && styles.circularThumbnail,
              { backgroundColor: theme.colors.surfaceVariant }
            ]} 
          />
        ) : (
          <View style={[
            styles.thumbnailImage, 
            type === 'artist' && styles.circularThumbnail,
            styles.thumbnailPlaceholder, 
            { backgroundColor: theme.colors.surfaceVariant }
          ]}>
            <MaterialCommunityIcons 
              name={getTypeIcon()} 
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
          {title}
        </Text>
        
        {subtitle && (
          <Text 
            variant="bodySmall" 
            numberOfLines={2}
            style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}
          >
            {subtitle}
          </Text>
        )}
      </View>
      
      {onMenuPress && (
        <View style={styles.actions}>
          <IconButton
            icon="dots-vertical"
            size={20}
            iconColor={theme.colors.onSurfaceVariant}
            onPress={onMenuPress}
          />
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  listItem: {
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
  circularThumbnail: {
    borderRadius: 28,
  },
  thumbnailPlaceholder: {
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
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  gridItem: {
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 0,
    flex: 1,
  },
  gridThumbnailContainer: {
    marginBottom: 8,
  },
  gridThumbnail: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 8,
    maxWidth: 120,
  },
  gridTitle: {
    textAlign: 'center',
    marginBottom: 4,
    fontWeight: '500',
  },
  gridSubtitle: {
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 16,
  },
});
