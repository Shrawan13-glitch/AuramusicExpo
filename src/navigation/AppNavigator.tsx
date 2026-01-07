import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator, CardStyleInterpolators } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAnimation } from '../store/AnimationContext';
import HomeScreen from '../screens/HomeScreen';
import SearchScreen from '../screens/SearchScreen';
import LibraryScreen from '../screens/LibraryScreen';
import MessagesScreen from '../screens/MessagesScreen';
import ArtistScreen from '../screens/ArtistScreen';
import AlbumScreen from '../screens/AlbumScreen';
import PlaylistScreen from '../screens/PlaylistScreen';
import ArtistItemsScreen from '../screens/ArtistItemsScreen';
import LoginScreen from '../screens/LoginScreen';
import NewReleasesScreen from '../screens/NewReleasesScreen';
import BrowseScreen from '../screens/BrowseScreen';
import RecentlyPlayedScreen from '../screens/RecentlyPlayedScreen';
import LikedSongsScreen from '../screens/LikedSongsScreen';
import SettingsScreen from '../screens/SettingsScreen';
import UpdateScreen from '../screens/UpdateScreen';
import PlayerSettingsScreen from '../screens/PlayerSettingsScreen';
import AboutScreen from '../screens/AboutScreen';
import DownloadedSongsScreen from '../screens/DownloadedSongsScreen';
import QualitySettingsScreen from '../screens/QualitySettingsScreen';
import SectionView from '../screens/SectionView';
import MiniPlayer from '../components/MiniPlayer';
import MessageDetailScreen from '../screens/MessageDetailScreen';
import AnimationSettingsScreen from '../screens/AnimationSettingsScreen';
import CachedSongsScreen from '../screens/CachedSongsScreen';
import CachedLyricsScreen from '../screens/CachedLyricsScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const TabNavigator = React.memo(({ onTabBarLayout }: { onTabBarLayout: (height: number) => void }) => {
  const insets = useSafeAreaInsets();
  const { settings } = useAnimation();
  const tabBarHeight = 49 + insets.bottom;
  
  React.useEffect(() => {
    onTabBarLayout(tabBarHeight);
  }, [tabBarHeight]);

  const screenOptions = {
    tabBarStyle: { backgroundColor: '#121212', borderTopColor: '#282828', position: 'absolute', bottom: 0, left: 0, right: 0, paddingBottom: insets.bottom, height: tabBarHeight },
    tabBarActiveTintColor: '#fff',
    tabBarInactiveTintColor: '#666',
    headerStyle: { backgroundColor: '#000' },
    headerTintColor: '#fff',
    headerShown: false,
    animation: 'shift',
  };
  
  return (
    <Tab.Navigator
      screenOptions={screenOptions}
      sceneContainerStyle={{ backgroundColor: '#000' }}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />
        }}
      />
      <Tab.Screen 
        name="Search" 
        component={SearchScreen}
        options={{
          tabBarLabel: 'Search',
          tabBarIcon: ({ color, size }) => <Ionicons name="search" size={size} color={color} />
        }}
      />
      <Tab.Screen 
        name="Messages" 
        component={MessagesScreen}
        options={{
          tabBarLabel: 'Messages',
          tabBarIcon: ({ color, size }) => <Ionicons name="mail" size={size} color={color} />
        }}
      />
      <Tab.Screen 
        name="Library" 
        component={LibraryScreen}
        options={{
          tabBarLabel: 'Library',
          tabBarIcon: ({ color, size }) => <Ionicons name="library" size={size} color={color} />
        }}
      />
    </Tab.Navigator>
  );
});

const MainScreen = React.memo(() => {
  const [tabBarHeight, setTabBarHeight] = useState(49);
  const insets = useSafeAreaInsets();
  
  const handleTabBarLayout = React.useCallback((height: number) => {
    setTabBarHeight(height);
  }, []);
  
  // Calculate tab bar height directly to avoid callback loop
  const calculatedTabBarHeight = 49 + insets.bottom;
  
  return (
    <View style={styles.container}>
      <View style={{ flex: 1 }}>
        <TabNavigator onTabBarLayout={handleTabBarLayout} />
      </View>
      <View style={[styles.miniPlayerAboveTab, { bottom: calculatedTabBarHeight }]}>
        <MiniPlayer />
      </View>
    </View>
  );
});

export default function AppNavigator() {
  const { settings } = useAnimation();
  
  const getAnimationConfig = () => {
    const speedDurations = {
      fast: 200,
      normal: 300,
      slow: 500
    };
    
    const duration = speedDurations[settings.speed];
    
    return {
      animationEnabled: true,
      cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
      transitionSpec: {
        open: { animation: 'timing', config: { duration } },
        close: { animation: 'timing', config: { duration } },
      },
    };
  };

  return (
    <Stack.Navigator 
      screenOptions={{ 
        headerShown: false, 
        presentation: 'card',
        cardStyle: { backgroundColor: '#000' },
        cardOverlayEnabled: false,
        ...getAnimationConfig(),
      }}
    >
      <Stack.Screen name="Main" component={MainScreen} />
      <Stack.Screen name="Artist">
        {(props) => (
          <View style={styles.container}>
            <View style={{ flex: 1 }}>
              <ArtistScreen {...props} />
            </View>
            <View style={styles.miniPlayerBottom}>
              <MiniPlayer />
            </View>
          </View>
        )}
      </Stack.Screen>
      <Stack.Screen name="Album">
        {(props) => (
          <View style={styles.container}>
            <View style={{ flex: 1 }}>
              <AlbumScreen {...props} />
            </View>
            <View style={styles.miniPlayerBottom}>
              <MiniPlayer />
            </View>
          </View>
        )}
      </Stack.Screen>
      <Stack.Screen name="Playlist">
        {(props) => (
          <View style={styles.container}>
            <View style={{ flex: 1 }}>
              <PlaylistScreen {...props} />
            </View>
            <View style={styles.miniPlayerBottom}>
              <MiniPlayer />
            </View>
          </View>
        )}
      </Stack.Screen>
      <Stack.Screen name="ArtistItems">
        {(props) => (
          <View style={styles.container}>
            <View style={{ flex: 1 }}>
              <ArtistItemsScreen {...props} />
            </View>
            <View style={styles.miniPlayerBottom}>
              <MiniPlayer />
            </View>
          </View>
        )}
      </Stack.Screen>
      <Stack.Screen name="NewReleases">
        {(props) => (
          <View style={styles.container}>
            <View style={{ flex: 1 }}>
              <NewReleasesScreen {...props} />
            </View>
            <View style={styles.miniPlayerBottom}>
              <MiniPlayer />
            </View>
          </View>
        )}
      </Stack.Screen>
      <Stack.Screen name="Browse">
        {(props) => (
          <View style={styles.container}>
            <View style={{ flex: 1 }}>
              <BrowseScreen {...props} />
            </View>
            <View style={styles.miniPlayerBottom}>
              <MiniPlayer />
            </View>
          </View>
        )}
      </Stack.Screen>
      <Stack.Screen name="RecentlyPlayed">
        {(props) => (
          <View style={styles.container}>
            <View style={{ flex: 1 }}>
              <RecentlyPlayedScreen {...props} />
            </View>
            <View style={styles.miniPlayerBottom}>
              <MiniPlayer />
            </View>
          </View>
        )}
      </Stack.Screen>
      <Stack.Screen name="LikedSongs">
        {(props) => (
          <View style={styles.container}>
            <View style={{ flex: 1 }}>
              <LikedSongsScreen {...props} />
            </View>
            <View style={styles.miniPlayerBottom}>
              <MiniPlayer />
            </View>
          </View>
        )}
      </Stack.Screen>
      <Stack.Screen name="Settings">
        {(props) => (
          <View style={styles.container}>
            <View style={{ flex: 1 }}>
              <SettingsScreen {...props} />
            </View>
            <View style={styles.miniPlayerBottom}>
              <MiniPlayer />
            </View>
          </View>
        )}
      </Stack.Screen>

      <Stack.Screen 
        name="PlayerSettings"
        options={{
          cardStyleInterpolator: CardStyleInterpolators.forRevealFromBottomAndroid,
        }}
      >
        {(props) => <PlayerSettingsScreen {...props} />}
      </Stack.Screen>
      <Stack.Screen 
        name="About"
        options={{
          cardStyleInterpolator: CardStyleInterpolators.forRevealFromBottomAndroid,
        }}
      >
        {(props) => <AboutScreen {...props} />}
      </Stack.Screen>
      <Stack.Screen name="DownloadedSongs">
        {(props) => (
          <View style={styles.container}>
            <View style={{ flex: 1 }}>
              <DownloadedSongsScreen {...props} />
            </View>
            <View style={styles.miniPlayerBottom}>
              <MiniPlayer />
            </View>
          </View>
        )}
      </Stack.Screen>
      <Stack.Screen name="QualitySettings">
        {(props) => (
          <View style={styles.container}>
            <View style={{ flex: 1 }}>
              <QualitySettingsScreen {...props} />
            </View>
            <View style={styles.miniPlayerBottom}>
              <MiniPlayer />
            </View>
          </View>
        )}
      </Stack.Screen>
      <Stack.Screen name="SectionView">
        {(props) => (
          <View style={styles.container}>
            <View style={{ flex: 1 }}>
              <SectionView {...props} />
            </View>
            <View style={styles.miniPlayerBottom}>
              <MiniPlayer />
            </View>
          </View>
        )}
      </Stack.Screen>
      <Stack.Screen name="CachedSongs">
        {(props) => (
          <View style={styles.container}>
            <View style={{ flex: 1 }}>
              <CachedSongsScreen {...props} />
            </View>
            <View style={styles.miniPlayerBottom}>
              <MiniPlayer />
            </View>
          </View>
        )}
      </Stack.Screen>
      <Stack.Screen name="CachedLyrics">
        {(props) => (
          <View style={styles.container}>
            <View style={{ flex: 1 }}>
              <CachedLyricsScreen {...props} />
            </View>
            <View style={styles.miniPlayerBottom}>
              <MiniPlayer />
            </View>
          </View>
        )}
      </Stack.Screen>
      <Stack.Screen 
        name="AnimationSettings"
        options={{
          cardStyleInterpolator: CardStyleInterpolators.forRevealFromBottomAndroid,
        }}
      >
        {(props) => <AnimationSettingsScreen {...props} />}
      </Stack.Screen>

      <Stack.Screen name="MessageDetail" component={MessageDetailScreen} />

      <Stack.Screen name="Update" component={UpdateScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  miniPlayerAboveTab: { position: 'absolute', left: 0, right: 0, zIndex: 10 },
  miniPlayerBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10 },
});
