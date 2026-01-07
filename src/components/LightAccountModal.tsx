import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface LightAccountModalProps {
  visible: boolean;
  onClose: () => void;
  isAuthenticated: boolean;
  accountInfo: any;
  onSignIn: () => void;
  onSettings: () => void;
  onSignOut: () => void;
}

export default function LightAccountModal({ 
  visible, 
  onClose, 
  isAuthenticated, 
  accountInfo, 
  onSignIn, 
  onSettings, 
  onSignOut 
}: LightAccountModalProps) {

  const MenuItem = ({ icon, title, onPress, danger = false }: any) => (
    <TouchableOpacity 
      style={styles.menuItem} 
      onPress={onPress} 
      activeOpacity={0.7}
    >
      <Ionicons name={icon} size={20} color={danger ? '#ff4757' : '#1db954'} />
      <Text style={[styles.menuTitle, danger && styles.dangerText]}>{title}</Text>
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />
        
        <View style={styles.modal}>
          {isAuthenticated && accountInfo ? (
            <View style={styles.profileSection}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {accountInfo.name?.[0]?.toUpperCase() || 'U'}
                </Text>
              </View>
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>{accountInfo.name || 'User'}</Text>
                <Text style={styles.profileEmail}>{accountInfo.email}</Text>
              </View>
            </View>
          ) : (
            <View style={styles.signInSection}>
              <Ionicons name="musical-notes" size={24} color="#1db954" />
              <Text style={styles.signInTitle}>Sign in to AuraMusic</Text>
            </View>
          )}

          <View style={styles.divider} />

          <View style={styles.menuSection}>
            {!isAuthenticated ? (
              <MenuItem
                icon="log-in"
                title="Sign In"
                onPress={() => {
                  onClose();
                  onSignIn();
                }}
              />
            ) : (
              <MenuItem
                icon="log-out"
                title="Sign Out"
                onPress={() => {
                  onClose();
                  onSignOut();
                }}
                danger={true}
              />
            )}
            
            <MenuItem
              icon="settings"
              title="Settings"
              onPress={() => {
                onClose();
                onSettings();
              }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modal: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    width: '90%',
    maxWidth: 380,
    borderWidth: 1,
    borderColor: '#333',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 24,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1db954',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    borderWidth: 2,
    borderColor: '#333',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: '#aaa',
  },
  signInSection: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 24,
  },
  signInTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 16,
  },
  divider: {
    height: 1,
    backgroundColor: '#333',
    marginHorizontal: 24,
  },
  menuSection: {
    padding: 24,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 12,
    borderRadius: 12,
    backgroundColor: '#222',
    borderWidth: 1,
    borderColor: '#333',
  },
  menuTitle: {
    fontSize: 17,
    fontWeight: '500',
    color: '#fff',
    marginLeft: 16,
  },
  dangerText: {
    color: '#ff4757',
  },
});