import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Animated, Dimensions, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface AccountModalProps {
  visible: boolean;
  onClose: () => void;
  isAuthenticated: boolean;
  accountInfo: any;
  onSignIn: () => void;
  onSettings: () => void;
  onSignOut: () => void;
}

export default function AccountModal({ 
  visible, 
  onClose, 
  isAuthenticated, 
  accountInfo, 
  onSignIn, 
  onSettings, 
  onSignOut 
}: AccountModalProps) {
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT * 0.5)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: SCREEN_HEIGHT * 0.5,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const MenuItem = React.memo(({ icon, title, subtitle, onPress, color = '#fff', danger = false }: any) => (
    <TouchableOpacity 
      style={styles.menuItem} 
      onPress={onPress} 
      activeOpacity={0.8}
      delayPressIn={0}
    >
      <View style={[styles.menuIconContainer, danger && styles.dangerIconContainer]}>
        <Ionicons name={icon} size={24} color={danger ? '#ff4757' : color} />
      </View>
      <View style={styles.menuContent}>
        <Text style={[styles.menuTitle, danger && styles.dangerText]}>{title}</Text>
        {subtitle && <Text style={styles.menuSubtitle}>{subtitle}</Text>}
      </View>
      <View style={styles.menuArrow}>
        <Ionicons name="chevron-forward" size={20} color="#666" />
      </View>
    </TouchableOpacity>
  ));

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.overlay, { opacity }]}>
        <TouchableOpacity 
          style={styles.backdrop} 
          onPress={onClose} 
          activeOpacity={1}
          delayPressIn={0}
        />
        
        <Animated.View 
          style={[
            styles.modal, 
            { transform: [{ translateY }] }
          ]}
        >
          <View style={styles.gradientBackground}>
            <View style={styles.handle} />
            
            {isAuthenticated && accountInfo ? (
              <View style={styles.profileSection}>
                <View style={styles.avatarContainer}>
                  {accountInfo.thumbnail ? (
                    <Image source={{ uri: accountInfo.thumbnail }} style={styles.avatar} />
                  ) : (
                    <View style={styles.avatarGradient}>
                      <Text style={styles.avatarText}>
                        {accountInfo.name?.[0]?.toUpperCase() || 'U'}
                      </Text>
                    </View>
                  )}
                  <View style={styles.onlineIndicator} />
                </View>
                
                <View style={styles.profileInfo}>
                  <Text style={styles.profileName}>{accountInfo.name || 'User'}</Text>
                  <Text style={styles.profileEmail}>{accountInfo.email}</Text>
                </View>
              </View>
            ) : (
              <View style={styles.signInSection}>
                <View style={styles.signInGradient}>
                  <Ionicons name="musical-notes" size={32} color="#fff" />
                </View>
                <Text style={styles.signInTitle}>Sign in to AuraMusic</Text>
                <Text style={styles.signInSubtitle}>Sync your music across all devices</Text>
              </View>
            )}

            <View style={styles.divider} />

            <View style={styles.menuSection}>
              {!isAuthenticated ? (
                <MenuItem
                  icon="log-in"
                  title="Sign In"
                  subtitle="Access your music library"
                  onPress={onSignIn}
                  color="#1db954"
                />
              ) : (
                <MenuItem
                  icon="log-out"
                  title="Sign Out"
                  onPress={onSignOut}
                  danger={true}
                />
              )}
              
              <MenuItem
                icon="settings"
                title="Settings"
                subtitle="App preferences"
                onPress={() => {
                  onClose();
                  setTimeout(onSettings, 100);
                }}
              />
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>AuraMusic v1.0.0</Text>
            </View>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modal: {
    backgroundColor: 'transparent',
    borderRadius: 24,
    overflow: 'hidden',
    width: '100%',
    maxWidth: 400,
    maxHeight: SCREEN_HEIGHT * 0.7,
  },
  gradientBackground: {
    paddingBottom: 40,
    backgroundColor: '#1a1a2e',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 24,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  avatarGradient: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    backgroundColor: '#1db954',
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#1db954',
    borderWidth: 2,
    borderColor: '#1a1a2e',
  },
  profileInfo: {
    flex: 1,
    marginLeft: 16,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 8,
  },

  signInSection: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  signInGradient: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    backgroundColor: '#1db954',
  },
  signInTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  signInSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginHorizontal: 24,
    marginBottom: 16,
  },
  menuSection: {
    paddingHorizontal: 24,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    minHeight: 56,
  },
  menuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  dangerIconContainer: {
    backgroundColor: 'rgba(255, 71, 87, 0.2)',
  },
  menuContent: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  menuSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  dangerText: {
    color: '#ff4757',
  },
  menuArrow: {
    opacity: 0.6,
  },
  footer: {
    alignItems: 'center',
    paddingTop: 24,
  },
  footerText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
  },
});