import React, { useCallback, useMemo, useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme, BottomNavigation, Appbar, Modal, Portal, Button, Text, Dialog } from 'react-native-paper';
import { View, StyleSheet, BackHandler } from 'react-native';

import HomeScreen from '../screens/HomeScreen';
import EnhancedSearchScreen from '../screens/EnhancedSearchScreen';
import LibraryScreen from '../screens/LibraryScreen';
import PlayerScreen from '../screens/PlayerScreen';
import PlaylistScreen from '../screens/PlaylistScreen';
import AlbumScreen from '../screens/AlbumScreen';
import ArtistScreen from '../screens/ArtistScreen';
import ShowAllScreen from '../screens/ShowAllScreen';
import ProfileScreen from '../screens/ProfileScreen';
import QueueScreen from '../screens/QueueScreen';
import PodcastScreen from '../screens/PodcastScreen';
import SettingsScreen from '../screens/SettingsScreen';
import AppearanceSettingsScreen from '../screens/AppearanceSettingsScreen';
import PlaybackSettingsScreen from '../screens/PlaybackSettingsScreen';
import MessagesScreen from '../screens/MessagesScreen';
import MessageDetailScreen from '../screens/MessageDetailScreen';
import DownloadsScreen from '../screens/DownloadsScreen';
import CacheScreen from '../screens/CacheScreen';
import UpdateScreen from '../screens/UpdateScreen';
import CookieViewer from '../components/CookieViewer';
import { useAuth } from '../contexts/AuthContext';

const Stack = createNativeStackNavigator();

const TabNavigator = React.memo(({ navigation }: { navigation: any }) => {
  const theme = useTheme();
  const { logout, isAuthenticated, cookies } = useAuth();
  const [index, setIndex] = React.useState(0);
  const [accountModalVisible, setAccountModalVisible] = React.useState(false);
  const [cookieViewerVisible, setCookieViewerVisible] = React.useState(false);
  
  const routes = useMemo(() => [
    { key: 'home', title: 'Home', focusedIcon: 'home', unfocusedIcon: 'home-outline' },
    { key: 'search', title: 'Search', focusedIcon: 'magnify' },
    { key: 'library', title: 'Library', focusedIcon: 'music-box-multiple', unfocusedIcon: 'music-box-multiple-outline' },
  ], []);

  const renderScene = useMemo(() => BottomNavigation.SceneMap({
    home: HomeScreen,
    search: () => <EnhancedSearchScreen navigation={navigation} />,
    library: LibraryScreen,
  }), [navigation]);

  const getTitle = useCallback(() => {
    switch (index) {
      case 0: return 'Mediyo';
      case 1: return 'Search';
      case 2: return 'Your Library';
      default: return 'Mediyo';
    }
  }, [index]);

  const handleLogout = useCallback(() => {
    logout();
    setAccountModalVisible(false);
  }, [logout]);

  const handleAccountPress = useCallback(() => {
    setAccountModalVisible(true);
  }, []);

  const handleModalDismiss = useCallback(() => {
    setAccountModalVisible(false);
  }, []);

  const handleShowCookies = useCallback(() => {
    setAccountModalVisible(false);
    setCookieViewerVisible(true);
  }, []);

  const handleCloseCookieViewer = useCallback(() => {
    setCookieViewerVisible(false);
  }, []);

  React.useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (typeof navigation?.isFocused === 'function' && !navigation.isFocused()) {
        return false;
      }
      if (cookieViewerVisible) {
        setCookieViewerVisible(false);
        return true;
      }
      if (accountModalVisible) {
        setAccountModalVisible(false);
        return true;
      }
      if (index !== 0) {
        setIndex(0);
        return true;
      }
      return false;
    });

    return () => subscription.remove();
  }, [accountModalVisible, cookieViewerVisible, index]);

  return (
    <>
      <View style={{ flex: 1 }}>
        {index !== 1 && (
          <Appbar.Header>
            <Appbar.Content title={getTitle()} />
            {index === 2 && (
              <Appbar.Action icon="download" onPress={() => navigation.navigate('Downloads')} />
            )}
            <Appbar.Action icon="message-text-outline" onPress={() => navigation.navigate('Messages')} />
            {isAuthenticated && (
              <Appbar.Action icon="account-circle" onPress={handleAccountPress} />
            )}
          </Appbar.Header>
        )}
        
        <View style={{ flex: 1, position: 'relative' }}>
          <BottomNavigation
            navigationState={{ index, routes }}
            onIndexChange={setIndex}
            renderScene={renderScene}
            shifting={true}
            sceneAnimationEnabled={true}
            sceneAnimationType="shifting"
            theme={theme}
            barStyle={{
              backgroundColor: theme.colors.surface,
              elevation: 8,
            }}
          />
        </View>
      </View>
      
      <Portal>
        <Dialog
          visible={accountModalVisible}
          onDismiss={handleModalDismiss}
          style={[styles.accountDialog, { backgroundColor: theme.colors.surface }]}
        >
          <Dialog.Title>Account</Dialog.Title>
          <Dialog.Content>
            <View style={styles.accountInfo}>
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                Authentication Status: {isAuthenticated ? 'Logged In' : 'Not Logged In'}
              </Text>
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                Cookies: {cookies.length} stored
              </Text>
            </View>
            <View style={styles.dialogButtons}>
              <Button
                mode="outlined"
                onPress={() => {
                  setAccountModalVisible(false);
                  navigation.navigate('Settings');
                }}
                style={styles.dialogButton}
                icon="cog"
              >
                Settings
              </Button>
              {cookies.length > 0 && (
                <Button
                  mode="outlined"
                  onPress={handleShowCookies}
                  style={styles.dialogButton}
                  icon="cookie"
                >
                  View Cookies
                </Button>
              )}
              <Button
                mode="contained"
                onPress={handleLogout}
                style={styles.dialogButton}
              >
                Logout
              </Button>
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={handleModalDismiss}>Close</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      
      <Portal>
        <Modal
          visible={cookieViewerVisible}
          onDismiss={handleCloseCookieViewer}
          contentContainerStyle={styles.cookieModalContainer}
        >
          <CookieViewer 
            cookies={cookies} 
            onClose={handleCloseCookieViewer}
          />
        </Modal>
      </Portal>
    </>
  );
});

export default function AppNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Main">
        {(props) => <TabNavigator {...props} />}
      </Stack.Screen>
      <Stack.Screen 
        name="Player" 
        component={PlayerScreen}
        options={{
          presentation: 'modal',
          gestureEnabled: false,
        }}
      />
      <Stack.Screen 
        name="Playlist" 
        component={PlaylistScreen}
        options={{
          presentation: 'modal',
          gestureEnabled: true,
        }}
      />
      <Stack.Screen 
        name="Album" 
        component={AlbumScreen}
        options={{
          presentation: 'modal',
          gestureEnabled: true,
        }}
      />
      <Stack.Screen 
        name="Artist" 
        component={ArtistScreen}
        options={{
          presentation: 'modal',
          gestureEnabled: true,
        }}
      />
      <Stack.Screen 
        name="ShowAll" 
        component={ShowAllScreen}
        options={{
          presentation: 'modal',
          gestureEnabled: true,
        }}
      />
      <Stack.Screen 
        name="Queue" 
        component={QueueScreen}
        options={{
          presentation: 'modal',
          animation: 'slide_from_bottom',
          gestureEnabled: true,
        }}
      />
      <Stack.Screen 
        name="Profile" 
        component={ProfileScreen}
        options={{
          presentation: 'modal',
          gestureEnabled: true,
        }}
      />
      <Stack.Screen
        name="Podcast"
        component={PodcastScreen}
        options={{
          presentation: 'modal',
          gestureEnabled: true,
        }}
      />
      <Stack.Screen 
        name="Settings" 
        component={SettingsScreen}
        options={{
          presentation: 'modal',
          gestureEnabled: true,
        }}
      />
      <Stack.Screen 
        name="AppearanceSettings" 
        component={AppearanceSettingsScreen}
        options={{
          presentation: 'modal',
          gestureEnabled: true,
        }}
      />
      <Stack.Screen 
        name="PlaybackSettings" 
        component={PlaybackSettingsScreen}
        options={{
          presentation: 'modal',
          gestureEnabled: true,
        }}
      />
      <Stack.Screen
        name="Messages"
        component={MessagesScreen}
        options={{
          presentation: 'modal',
          animation: 'slide_from_right',
          gestureEnabled: true,
        }}
      />
      <Stack.Screen
        name="MessageDetail"
        component={MessageDetailScreen}
        options={{
          presentation: 'modal',
          animation: 'slide_from_right',
          gestureEnabled: true,
        }}
      />
      <Stack.Screen
        name="Downloads"
        component={DownloadsScreen}
        options={{
          presentation: 'modal',
          animation: 'slide_from_right',
          gestureEnabled: true,
        }}
      />
      <Stack.Screen
        name="Cache"
        component={CacheScreen}
        options={{
          presentation: 'modal',
          animation: 'slide_from_right',
          gestureEnabled: true,
        }}
      />
      <Stack.Screen
        name="Update"
        component={UpdateScreen}
        options={{
          presentation: 'modal',
          animation: 'slide_from_right',
          gestureEnabled: true,
        }}
      />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  accountDialog: {
    margin: 20,
    borderRadius: 16,
  },
  accountInfo: {
    marginBottom: 16,
    gap: 4,
  },
  dialogButtons: {
    gap: 12,
  },
  dialogButton: {
    borderRadius: 8,
  },
  cookieModalContainer: {
    margin: 20,
    borderRadius: 16,
    flex: 1,
    maxHeight: '80%',
  },
});
