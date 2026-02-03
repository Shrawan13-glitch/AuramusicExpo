import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Text, Card, Chip, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface SearchSuggestionsProps {
  onSuggestionPress: (suggestion: string) => void;
}

export default function SearchSuggestions({ onSuggestionPress }: SearchSuggestionsProps) {
  const theme = useTheme();

  const trendingQueries = [
    'Pop music',
    'Rock hits',
    'Hip Hop',
    'Electronic',
    'Indie music',
    'Classical',
    'Jazz',
    'Country'
  ];

  const quickSearches = [
    'Latest hits',
    'Top charts',
    'New releases',
    'Trending now'
  ];

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.content}>
        <Text variant="headlineSmall" style={[styles.sectionTitle, { color: theme.colors.onBackground }]}>
          Browse music
        </Text>
        
        {/* Quick Search Chips */}
        <View style={styles.chipContainer}>
          {quickSearches.map((search, index) => (
            <Chip 
              key={index}
              icon="trending-up"
              style={[styles.chip, { backgroundColor: theme.colors.primaryContainer }]}
              textStyle={{ color: theme.colors.onPrimaryContainer }}
              onPress={() => onSuggestionPress(search)}
            >
              {search}
            </Chip>
          ))}
        </View>

        {/* Genre Chips */}
        <Text variant="titleMedium" style={[styles.subsectionTitle, { color: theme.colors.onBackground }]}>
          Popular genres
        </Text>
        
        <View style={styles.chipContainer}>
          {trendingQueries.map((genre, index) => (
            <Chip 
              key={index}
              icon="music" 
              style={[styles.chip, { backgroundColor: theme.colors.secondaryContainer }]}
              textStyle={{ color: theme.colors.onSecondaryContainer }}
              onPress={() => onSuggestionPress(genre)}
            >
              {genre}
            </Chip>
          ))}
        </View>
        
        {/* Trending Card */}
        <Card style={[styles.trendingCard, { backgroundColor: theme.colors.surface }]}>
          <Card.Content style={styles.trendingContent}>
            <MaterialCommunityIcons 
              name="trending-up" 
              size={32} 
              color={theme.colors.primary} 
            />
            <View style={styles.trendingText}>
              <Text variant="titleMedium" style={{ color: theme.colors.onSurface }}>
                Discover trending music
              </Text>
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                Find what's popular right now
              </Text>
            </View>
          </Card.Content>
        </Card>

        {/* Search Tips */}
        <Card style={[styles.tipsCard, { backgroundColor: theme.colors.surfaceVariant }]}>
          <Card.Content>
            <Text variant="titleSmall" style={[styles.tipsTitle, { color: theme.colors.onSurfaceVariant }]}>
              Search tips
            </Text>
            <Text variant="bodySmall" style={[styles.tipsText, { color: theme.colors.onSurfaceVariant }]}>
              • Try searching for song titles, artist names, or album names{'\n'}
              • Use filters to find specific content types{'\n'}
              • Search works best with exact titles or popular terms
            </Text>
          </Card.Content>
        </Card>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 24,
  },
  sectionTitle: {
    fontWeight: '500',
    marginBottom: 24,
  },
  subsectionTitle: {
    fontWeight: '500',
    marginBottom: 16,
    marginTop: 8,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  chip: {
    borderRadius: 16,
  },
  trendingCard: {
    borderRadius: 16,
    elevation: 2,
    marginBottom: 16,
  },
  trendingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  trendingText: {
    flex: 1,
  },
  tipsCard: {
    borderRadius: 12,
    elevation: 1,
  },
  tipsTitle: {
    fontWeight: '600',
    marginBottom: 8,
  },
  tipsText: {
    lineHeight: 18,
  },
});