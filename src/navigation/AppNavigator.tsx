import React from 'react';
import { View, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import HomeScreen from '../screens/HomeScreen';
import SearchScreen from '../screens/SearchScreen';
import LibraryScreen from '../screens/LibraryScreen';
import ArtistScreen from '../screens/ArtistScreen';
import AlbumScreen from '../screens/AlbumScreen';
import PlaylistScreen from '../screens/PlaylistScreen';
import ArtistItemsScreen from '../screens/ArtistItemsScreen';
import MiniPlayer from '../components/MiniPlayer';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarStyle: { backgroundColor: '#000', borderTopColor: '#333', position: 'absolute', bottom: 0, left: 0, right: 0 },
        tabBarActiveTintColor: '#fff',
        tabBarInactiveTintColor: '#666',
        headerStyle: { backgroundColor: '#000' },
        headerTintColor: '#fff',
      }}
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
        name="Library" 
        component={LibraryScreen}
        options={{
          tabBarLabel: 'Library',
          tabBarIcon: ({ color, size }) => <Ionicons name="library" size={size} color={color} />
        }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, presentation: 'card' }}>
      <Stack.Screen name="Main">
        {() => (
          <View style={styles.container}>
            <View style={{ flex: 1 }}>
              <TabNavigator />
            </View>
            <View style={styles.miniPlayerAboveTab}>
              <MiniPlayer />
            </View>
          </View>
        )}
      </Stack.Screen>
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
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  miniPlayerAboveTab: { position: 'absolute', bottom: 61, left: 0, right: 0, zIndex: 10 },
  miniPlayerBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10 },
});
