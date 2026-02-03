import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Button, Text, useTheme } from 'react-native-paper';
import SearchResultItem from './SearchResultItem';

interface ProfileSearchTestProps {
  navigation: any;
}

export default function ProfileSearchTest({ navigation }: ProfileSearchTestProps) {
  const theme = useTheme();

  const mockProfileResult = {
    id: 'UCG8Rlcw5HU4tjnqyJJ--e5w',
    title: 'RUTHLESS PHONK',
    artist: 'Channel',
    thumbnail: 'https://yt3.googleusercontent.com/MSYsO8sqo6xAROngBfbWtXPyw7UDuuhqQshQb2HhqXWffo6IFJ7Ko6VWQATy7ccxBSl9Phy6dfE=w544-c-h544-k-c0x00ffffff-no-l90-rj',
    type: 'profile' as const,
    subscribers: '24 subscribers'
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Text variant="titleMedium" style={[styles.title, { color: theme.colors.onSurface }]}>
        Test Profile Search Result
      </Text>
      
      <SearchResultItem
        item={mockProfileResult}
        onPress={() => {}}
        navigation={navigation}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  title: {
    marginBottom: 16,
    fontWeight: '500',
  },
});