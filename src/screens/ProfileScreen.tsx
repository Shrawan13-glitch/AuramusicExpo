import React from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Image,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import {
  Text,
  useTheme,
  Button,
  IconButton,
  Surface,
  Appbar,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import ArtistCard from '../components/ArtistCard';

const { width: screenWidth } = Dimensions.get('window');

interface ProfileData {
  title: string;
  description?: string;
  thumbnail: string;
  bannerThumbnail?: string;
  subscriberCount: string;
  isSubscribed: boolean;
  channelId: string;
  sections: ProfileSection[];
}

interface ProfileSection {
  title: string;
  items: ProfileItem[];
}

interface ProfileItem {
  id: string;
  title: string;
  subtitle?: string;
  thumbnail: string;
  type: string;
  views?: string;
}

interface ProfileScreenProps {
  navigation: any;
  route: {
    params: {
      profileData: ProfileData;
    };
  };
}

export default function ProfileScreen({ navigation, route }: ProfileScreenProps) {
  const theme = useTheme();
  const { profileData } = route.params;

  const handleSubscribe = () => {
    // Handle subscription logic
    console.log('Subscribe/Unsubscribe');
  };

  const handleItemPress = (item: ProfileItem) => {
    // Navigate based on item type
    switch (item.type) {
      case 'song':
      case 'video':
        // Handle play
        break;
      case 'album':
        navigation.navigate('Album', { albumId: item.id });
        break;
      case 'playlist':
        navigation.navigate('Playlist', { playlistId: item.id });
        break;
      case 'artist':
        navigation.navigate('Artist', { artistId: item.id });
        break;
    }
  };

  const renderSection = (section: ProfileSection, index: number) => (
    <View key={index} style={styles.section}>
      <Text
        variant="headlineSmall"
        style={[styles.sectionTitle, { color: theme.colors.onSurface }]}
      >
        {section.title}
      </Text>
      
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.horizontalList}
      >
        {section.items.map((item, itemIndex) => (
          <View key={itemIndex} style={styles.horizontalItem}>
            <TouchableOpacity
              onPress={() => handleItemPress(item)}
              style={styles.itemContainer}
            >
              <Image
                source={{ uri: item.thumbnail }}
                style={[
                  styles.itemThumbnail,
                  item.type === 'artist' && styles.circularThumbnail,
                  { backgroundColor: theme.colors.surfaceVariant }
                ]}
              />
              <Text
                variant="titleSmall"
                numberOfLines={2}
                style={[styles.itemTitle, { color: theme.colors.onSurface }]}
              >
                {item.title}
              </Text>
              {item.subtitle && (
                <Text
                  variant="bodySmall"
                  numberOfLines={1}
                  style={[styles.itemSubtitle, { color: theme.colors.onSurfaceVariant }]}
                >
                  {item.subtitle}
                </Text>
              )}
              {item.views && (
                <Text
                  variant="bodySmall"
                  style={[styles.itemViews, { color: theme.colors.onSurfaceVariant }]}
                >
                  {item.views}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="" />
        <Appbar.Action icon="share" onPress={() => {}} />
        <Appbar.Action icon="dots-vertical" onPress={() => {}} />
      </Appbar.Header>

      <ScrollView style={styles.scrollView}>
        {/* Banner Section */}
        <View style={styles.bannerContainer}>
          {profileData.bannerThumbnail ? (
            <Image
              source={{ uri: profileData.bannerThumbnail }}
              style={styles.bannerImage}
            />
          ) : (
            <View
              style={[styles.bannerGradient, { backgroundColor: theme.colors.surfaceVariant }]}
            />
          )}
          
          {/* Profile Avatar */}
          <View style={styles.avatarContainer}>
            <Surface style={[styles.avatarSurface, { backgroundColor: theme.colors.surface }]}>
              <Image
                source={{ uri: profileData.thumbnail }}
                style={styles.avatar}
              />
            </Surface>
          </View>
        </View>

        {/* Profile Info */}
        <View style={styles.profileInfo}>
          <Text
            variant="headlineMedium"
            style={[styles.profileTitle, { color: theme.colors.onSurface }]}
          >
            {profileData.title}
          </Text>
          
          <Text
            variant="bodyMedium"
            style={[styles.subscriberCount, { color: theme.colors.onSurfaceVariant }]}
          >
            {profileData.subscriberCount} subscribers
          </Text>

          {profileData.description && (
            <Text
              variant="bodySmall"
              style={[styles.description, { color: theme.colors.onSurfaceVariant }]}
              numberOfLines={3}
            >
              {profileData.description}
            </Text>
          )}

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <Button
              mode={profileData.isSubscribed ? "outlined" : "contained"}
              onPress={handleSubscribe}
              style={styles.subscribeButton}
              contentStyle={styles.buttonContent}
            >
              {profileData.isSubscribed ? "Subscribed" : "Subscribe"}
            </Button>
            
            <IconButton
              icon="shuffle"
              mode="contained"
              size={24}
              onPress={() => {}}
              style={styles.shuffleButton}
            />
          </View>
        </View>

        {/* Content Sections */}
        <View style={styles.content}>
          {profileData.sections.map((section, index) => renderSection(section, index))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  bannerContainer: {
    height: 200,
    position: 'relative',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  bannerGradient: {
    width: '100%',
    height: '100%',
  },
  avatarContainer: {
    position: 'absolute',
    bottom: -40,
    left: 24,
  },
  avatarSurface: {
    borderRadius: 50,
    elevation: 4,
    padding: 4,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  profileInfo: {
    paddingTop: 50,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  profileTitle: {
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subscriberCount: {
    marginBottom: 12,
  },
  description: {
    lineHeight: 20,
    marginBottom: 20,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  subscribeButton: {
    flex: 1,
    borderRadius: 20,
  },
  buttonContent: {
    paddingVertical: 4,
  },
  shuffleButton: {
    borderRadius: 20,
  },
  content: {
    paddingBottom: 100,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    paddingHorizontal: 24,
    marginBottom: 16,
    fontWeight: '600',
  },
  horizontalList: {
    paddingLeft: 24,
    paddingRight: 8,
  },
  horizontalItem: {
    marginRight: 16,
  },
  itemContainer: {
    width: 140,
  },
  itemThumbnail: {
    width: 140,
    height: 140,
    borderRadius: 8,
    marginBottom: 8,
  },
  circularThumbnail: {
    borderRadius: 70,
  },
  itemTitle: {
    fontWeight: '500',
    marginBottom: 2,
    lineHeight: 18,
  },
  itemSubtitle: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 2,
  },
  itemViews: {
    fontSize: 11,
    opacity: 0.7,
  },
});