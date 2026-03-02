import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Appbar, List, Text, useTheme } from 'react-native-paper';
import Constants from 'expo-constants';

interface SettingsScreenProps {
  navigation: any;
}

export default function SettingsScreen({ navigation }: SettingsScreenProps) {
  const theme = useTheme();
  const appVersion =
    Constants.expoConfig?.version ||
    (Constants.manifest2 as { extra?: { expoClient?: { version?: string } } } | null)?.extra?.expoClient?.version ||
    'Unknown';

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="Settings" />
      </Appbar.Header>

      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="titleSmall" style={[styles.sectionTitle, { color: theme.colors.onSurfaceVariant }]}>
          Playback
        </Text>
        <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <List.Item
            title="Playback settings"
            description="Audio quality, seek duration"
            onPress={() => navigation.navigate('PlaybackSettings')}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
          />
        </View>

        <Text variant="titleSmall" style={[styles.sectionTitle, { color: theme.colors.onSurfaceVariant }]}>
          Appearance
        </Text>
        <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <List.Item
            title="Player appearance"
            description="Background style, splash duration"
            onPress={() => navigation.navigate('AppearanceSettings')}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
          />
        </View>

        <Text variant="titleSmall" style={[styles.sectionTitle, { color: theme.colors.onSurfaceVariant }]}>
          Storage
        </Text>
        <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <List.Item
            title="Cache details"
            description="View cached songs and size"
            onPress={() => navigation.navigate('Cache')}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
          />
        </View>

        <Text variant="titleSmall" style={[styles.sectionTitle, { color: theme.colors.onSurfaceVariant }]}>
          About
        </Text>
        <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <List.Item title="Version" description={appVersion} />
          <List.Item
            title="Check for updates"
            description="Manage OTA and APK updates"
            onPress={() => navigation.navigate('Update')}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
          />
        </View>
      </ScrollView>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
    gap: 12,
  },
  sectionTitle: {
    marginTop: 8,
    marginBottom: 4,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  card: {
    borderRadius: 16,
    overflow: 'hidden',
  },
});
