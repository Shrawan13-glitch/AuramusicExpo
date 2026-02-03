import React, { useCallback, useMemo, useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme, BottomNavigation, Appbar, Modal, Portal, Button, Text } from 'react-native-paper';
import { View, StyleSheet } from 'react-native';

import HomeScreen from '../screens/HomeScreen';
import EnhancedSearchScreen from '../screens/EnhancedSearchScreen';
import LibraryScreen from '../screens/LibraryScreen';
import PlayerScreen from '../screens/PlayerScreen';
import PlaylistScreen from '../screens/PlaylistScreen';
import AlbumScreen from '../screens/AlbumScreen';
import ArtistScreen from '../screens/ArtistScreen';
import ShowAllScreen from '../screens/ShowAllScreen';
import ProfileScreen from '../screens/ProfileScreen';
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
      case 0: return 'AuraMusic';
      case 1: return 'Search';
      case 2: return 'Your Library';
      default: return 'AuraMusic';
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

  return (
    <>
      <View style={{ flex: 1 }}>
        {index !== 1 && (
          <Appbar.Header>
            <Appbar.Content title={getTitle()} />
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
        <Modal
          visible={accountModalVisible}
          onDismiss={handleModalDismiss}
          contentContainerStyle={[styles.modalContainer, { backgroundColor: theme.colors.surface }]}
        >
          <Text variant="headlineSmall" style={[styles.modalTitle, { color: theme.colors.onSurface }]}>
            Account
          </Text>
          
          <View style={styles.accountInfo}>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              Authentication Status: {isAuthenticated ? 'Logged In' : 'Not Logged In'}
            </Text>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              Cookies: {cookies.length} stored
            </Text>
          </View>
          
          <View style={styles.modalButtons}>
            {cookies.length > 0 && (
              <Button
                mode="outlined"
                onPress={handleShowCookies}
                style={styles.modalButton}
                icon="cookie"
              >
                View Cookies
              </Button>
            )}
            <Button
              mode="contained"
              onPress={handleLogout}
              style={styles.modalButton}
            >
              Logout
            </Button>
          </View>
        </Modal>
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
          gestureEnabled: true,
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
        name="Profile" 
        component={ProfileScreen}
        options={{
          presentation: 'modal',
          gestureEnabled: true,
        }}
      />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    margin: 20,
    padding: 24,
    borderRadius: 16,
  },
  modalTitle: {
    marginBottom: 16,
    textAlign: 'center',
  },
  accountInfo: {
    marginBottom: 24,
    gap: 4,
  },
  modalButtons: {
    gap: 12,
  },
  modalButton: {
    borderRadius: 8,
  },
  cookieModalContainer: {
    margin: 20,
    borderRadius: 16,
    flex: 1,
    maxHeight: '80%',
  },
});
