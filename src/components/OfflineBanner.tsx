import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNetwork } from '../store/NetworkContext';

interface OfflineBannerProps {
  onDownloadsPress?: () => void;
  onTryAgain?: () => void;
}

export default function OfflineBanner({ onDownloadsPress, onTryAgain }: OfflineBannerProps) {
  const { isOnline, checkConnection } = useNetwork();

  if (isOnline) return null;

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Ionicons name="wifi-outline" size={24} color="#ff6b6b" />
        <View style={styles.textContainer}>
          <Text style={styles.title}>You're Offline</Text>
          <Text style={styles.subtitle}>Check your internet connection</Text>
        </View>
      </View>
      
      <View style={styles.actions}>
        {onDownloadsPress && (
          <TouchableOpacity style={styles.button} onPress={onDownloadsPress}>
            <Ionicons name="download-outline" size={16} color="#1db954" />
            <Text style={styles.buttonText}>Downloads</Text>
          </TouchableOpacity>
        )}
        
        <TouchableOpacity style={styles.button} onPress={() => {
          checkConnection();
          onTryAgain?.();
        }}>
          <Ionicons name="refresh-outline" size={16} color="#1db954" />
          <Text style={styles.buttonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  textContainer: {
    flex: 1,
    marginLeft: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 14,
    color: '#aaa',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(29, 185, 84, 0.1)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(29, 185, 84, 0.3)',
    gap: 6,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1db954',
  },
});