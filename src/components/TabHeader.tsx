import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../store/AuthContext';
import AccountModal from './AccountModal';

interface TabHeaderProps {
  title: string;
  navigation: any;
}

export default function TabHeader({ title, navigation }: TabHeaderProps) {
  const { isAuthenticated, accountInfo, logout } = useAuth();
  const [showAccountModal, setShowAccountModal] = useState(false);

  return (
    <>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={() => navigation.navigate('RecentlyPlayed')} style={styles.recentButton}>
            <Ionicons name="time" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowAccountModal(true)} style={styles.accountButton}>
          {isAuthenticated && accountInfo?.thumbnail ? (
            <Image source={{ uri: accountInfo.thumbnail }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>{accountInfo?.name?.[0]?.toUpperCase() || 'U'}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>

      <AccountModal
        visible={showAccountModal}
        onClose={() => setShowAccountModal(false)}
        isAuthenticated={isAuthenticated}
        accountInfo={accountInfo}
        onSignIn={() => { setShowAccountModal(false); navigation.navigate('Login'); }}
        onSettings={() => navigation.navigate('Settings')}
        onSignOut={() => { setShowAccountModal(false); logout(); }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: '#000',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  recentButton: {
    padding: 4,
  },
  accountButton: {
    padding: 4,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  avatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1db954',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
});
