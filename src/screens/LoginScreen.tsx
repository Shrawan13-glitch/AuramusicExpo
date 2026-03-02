import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Appbar, Avatar, Button, Surface, Text, useTheme } from 'react-native-paper';

interface LoginScreenProps {
  onLoginPress: () => void;
}

const LoginScreen = React.memo(({ onLoginPress }: LoginScreenProps) => {
  const theme = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header statusBarHeight={0}>
        <Appbar.Content title="Mediyo" />
      </Appbar.Header>

      <View style={styles.content}>
        <Surface style={styles.card} elevation={2}>
          <Avatar.Icon size={56} icon="music" style={styles.avatar} />
          <Text variant="headlineSmall" style={{ color: theme.colors.onSurface }}>
            Welcome to Mediyo v3.1
          </Text>
          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onSurface, textAlign: 'center' }}
          >
            For a faster and more reliable experience, please log in to continue.
          </Text>
          <Button
            mode="contained"
            onPress={onLoginPress}
            style={styles.button}
            contentStyle={styles.buttonContent}
          >
            Login
          </Button>
        </Surface>
      </View>
    </SafeAreaView>
  );
});

export default LoginScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    paddingHorizontal: 24,
    paddingVertical: 28,
    alignItems: 'center',
    gap: 12,
    borderRadius: 20,
  },
  avatar: {
    backgroundColor: 'transparent',
  },
  button: {
    marginTop: 12,
    width: '100%',
  },
  buttonContent: {
    paddingVertical: 6,
  },
});
