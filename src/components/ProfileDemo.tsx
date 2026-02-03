import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Button, Text, useTheme } from 'react-native-paper';
import { createMockProfileData } from '../utils/profileParser';

interface ProfileDemoProps {
  navigation: any;
}

export default function ProfileDemo({ navigation }: ProfileDemoProps) {
  const theme = useTheme();

  const handleOpenProfile = () => {
    const mockProfileData = createMockProfileData();
    navigation.navigate('Profile', { profileData: mockProfileData });
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Text variant="headlineMedium" style={[styles.title, { color: theme.colors.onSurface }]}>
        Profile Demo
      </Text>
      
      <Text variant="bodyMedium" style={[styles.description, { color: theme.colors.onSurfaceVariant }]}>
        Tap the button below to see the beautiful profile screen in action.
      </Text>
      
      <Button
        mode="contained"
        onPress={handleOpenProfile}
        style={styles.button}
        contentStyle={styles.buttonContent}
      >
        Open RUTHLESS PHONK Profile
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    marginBottom: 16,
    textAlign: 'center',
  },
  description: {
    marginBottom: 32,
    textAlign: 'center',
    lineHeight: 20,
  },
  button: {
    borderRadius: 20,
  },
  buttonContent: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
});