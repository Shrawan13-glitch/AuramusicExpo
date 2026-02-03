import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

const HomeScreen = React.memo(() => {
  const theme = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.placeholder}>
        <Text variant="headlineSmall" style={{ color: theme.colors.onBackground }}>
          Home coming soon
        </Text>
        <Text
          variant="bodyMedium"
          style={[styles.subtitle, { color: theme.colors.onBackground }]}
        >
          We are working on a cleaner, faster home experience.
        </Text>
      </View>
    </View>
  );
});

export default HomeScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    justifyContent: 'center',
  },
  placeholder: {
    alignItems: 'center',
    gap: 8,
  },
  subtitle: {
    marginTop: 8,
    textAlign: 'center',
  },
});
