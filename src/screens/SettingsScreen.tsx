import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Appbar, Divider, List, Text, useTheme } from 'react-native-paper';

interface SettingsScreenProps {
  navigation: any;
}

export default function SettingsScreen({ navigation }: SettingsScreenProps) {
  const theme = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="Settings" />
      </Appbar.Header>

      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="titleSmall" style={[styles.sectionTitle, { color: theme.colors.onSurfaceVariant }]}>
          Appearance
        </Text>
        <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <List.Item
            title="Appearance settings"
            description="Player background style"
            onPress={() => navigation.navigate('AppearanceSettings')}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
          />
        </View>

        <Text variant="titleSmall" style={[styles.sectionTitle, { color: theme.colors.onSurfaceVariant }]}>
          About
        </Text>
        <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <List.Item title="Version" description="2.1.0" />
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
