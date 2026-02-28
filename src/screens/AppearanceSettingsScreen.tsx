import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Appbar, Dialog, List, Portal, RadioButton, Text, useTheme, Button } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { notifyPlayerBgStyleChanged } from '../utils/settingsEvents';
import {
  DEFAULT_SPLASH_MIN_DURATION_MS,
  normalizeSplashMinDurationMs,
  splashDurationLabel,
  SPLASH_DURATION_OPTIONS_MS,
  SPLASH_MIN_DURATION_KEY,
} from '../utils/splashSettings';

type PlayerBgStyle = 'image-gradient' | 'solid-gradient' | 'artwork-blur' | 'artwork-muted';

const PLAYER_BG_KEY = 'player_bg_style';
const PLAYER_BG_STYLES: PlayerBgStyle[] = ['image-gradient', 'solid-gradient', 'artwork-blur', 'artwork-muted'];

const isPlayerBgStyle = (value: string | null): value is PlayerBgStyle =>
  !!value && PLAYER_BG_STYLES.includes(value as PlayerBgStyle);

const PLAYER_BG_LABELS: Record<PlayerBgStyle, string> = {
  'image-gradient': 'Artwork gradient',
  'solid-gradient': 'Solid gradient',
  'artwork-blur': 'Artwork blur',
  'artwork-muted': 'Artwork soft',
};

interface AppearanceSettingsScreenProps {
  navigation: any;
}

export default function AppearanceSettingsScreen({ navigation }: AppearanceSettingsScreenProps) {
  const theme = useTheme();
  const [value, setValue] = useState<PlayerBgStyle>('image-gradient');
  const [dialogVisible, setDialogVisible] = useState(false);
  const [splashDurationMs, setSplashDurationMs] = useState(DEFAULT_SPLASH_MIN_DURATION_MS);
  const [splashDialogVisible, setSplashDialogVisible] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(PLAYER_BG_KEY)
      .then((stored) => {
        if (stored === 'artwork-vibrant') {
          setValue('artwork-blur');
          AsyncStorage.setItem(PLAYER_BG_KEY, 'artwork-blur').catch(() => {});
          return;
        }
        if (isPlayerBgStyle(stored)) {
          setValue(stored);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(SPLASH_MIN_DURATION_KEY)
      .then((stored) => setSplashDurationMs(normalizeSplashMinDurationMs(stored)))
      .catch(() => setSplashDurationMs(DEFAULT_SPLASH_MIN_DURATION_MS));
  }, []);

  const handleChange = async (next: PlayerBgStyle) => {
    setValue(next);
    try {
      await AsyncStorage.setItem(PLAYER_BG_KEY, next);
    } catch {
      // no-op
    }
    notifyPlayerBgStyleChanged();
  };

  const handleSplashDurationChange = async (next: number) => {
    setSplashDurationMs(next);
    try {
      await AsyncStorage.setItem(SPLASH_MIN_DURATION_KEY, String(next));
    } catch {
      // no-op
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="Appearance" />
      </Appbar.Header>

      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="titleSmall" style={[styles.sectionTitle, { color: theme.colors.onSurfaceVariant }]}>
          Player Background
        </Text>
        <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <List.Item
            title="Player background style"
            description={PLAYER_BG_LABELS[value]}
            onPress={() => setDialogVisible(true)}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
          />
        </View>

        <Text variant="titleSmall" style={[styles.sectionTitle, { color: theme.colors.onSurfaceVariant }]}>
          Startup
        </Text>
        <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <List.Item
            title="Splash minimum duration"
            description={splashDurationLabel(splashDurationMs)}
            onPress={() => setSplashDialogVisible(true)}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
          />
        </View>
      </ScrollView>

      <Portal>
        <Dialog visible={splashDialogVisible} onDismiss={() => setSplashDialogVisible(false)}>
          <Dialog.Title>Splash minimum duration</Dialog.Title>
          <Dialog.Content>
            <RadioButton.Group
              value={String(splashDurationMs)}
              onValueChange={(next) => handleSplashDurationChange(Number.parseInt(next, 10))}
            >
              {SPLASH_DURATION_OPTIONS_MS.map((ms) => (
                <RadioButton.Item
                  key={ms}
                  label={splashDurationLabel(ms)}
                  value={String(ms)}
                />
              ))}
            </RadioButton.Group>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setSplashDialogVisible(false)}>Done</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Portal>
        <Dialog visible={dialogVisible} onDismiss={() => setDialogVisible(false)}>
          <Dialog.Title>Player background</Dialog.Title>
          <Dialog.Content>
            <RadioButton.Group
              value={value}
              onValueChange={(next) => handleChange(next as PlayerBgStyle)}
            >
              <RadioButton.Item
                label="Artwork gradient"
                value="image-gradient"
              />
              <RadioButton.Item
                label="Solid gradient"
                value="solid-gradient"
              />
              <RadioButton.Item
                label="Artwork blur"
                value="artwork-blur"
              />
              <RadioButton.Item
                label="Artwork soft"
                value="artwork-muted"
              />
            </RadioButton.Group>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDialogVisible(false)}>Cancel</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
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
