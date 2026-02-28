import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Appbar, Dialog, List, Portal, RadioButton, Text, useTheme, Button } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';

type AudioQuality = 'low' | 'medium' | 'high' | 'auto';
type SeekDuration = 5 | 10 | 15 | 30;
type LyricsTextSize = 0.85 | 1 | 1.15 | 1.3;

const AUDIO_QUALITY_KEY = 'audio_quality';
const SEEK_DURATION_KEY = 'seek_duration';
const LYRICS_SIZE_KEY = 'lyrics_text_size';

const AUDIO_QUALITY_LABELS: Record<AudioQuality, string> = {
  low: 'Low (64 kbps)',
  medium: 'Medium (128 kbps)',
  high: 'High (256 kbps)',
  auto: 'Auto (adaptive)',
};

const SEEK_DURATION_OPTIONS: SeekDuration[] = [5, 10, 15, 30];
const LYRICS_SIZE_OPTIONS: LyricsTextSize[] = [0.85, 1, 1.15, 1.3];

const LYRICS_SIZE_LABELS: Record<LyricsTextSize, string> = {
  0.85: 'Small',
  1: 'Medium',
  1.15: 'Large',
  1.3: 'Extra Large',
};

interface PlaybackSettingsScreenProps {
  navigation: any;
}

export default function PlaybackSettingsScreen({ navigation }: PlaybackSettingsScreenProps) {
  const theme = useTheme();
  const [audioQuality, setAudioQuality] = useState<AudioQuality>('auto');
  const [seekDuration, setSeekDuration] = useState<SeekDuration>(5);
  const [lyricsSize, setLyricsSize] = useState<LyricsTextSize>(1);
  const [qualityDialogVisible, setQualityDialogVisible] = useState(false);
  const [seekDialogVisible, setSeekDialogVisible] = useState(false);
  const [lyricsSizeDialogVisible, setLyricsSizeDialogVisible] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(AUDIO_QUALITY_KEY)
      .then((stored) => {
        if (stored && ['low', 'medium', 'high', 'auto'].includes(stored)) {
          setAudioQuality(stored as AudioQuality);
        }
      })
      .catch(() => {});

    AsyncStorage.getItem(SEEK_DURATION_KEY)
      .then((stored) => {
        const parsed = Number(stored);
        if (SEEK_DURATION_OPTIONS.includes(parsed as SeekDuration)) {
          setSeekDuration(parsed as SeekDuration);
        }
      })
      .catch(() => {});

    AsyncStorage.getItem(LYRICS_SIZE_KEY)
      .then((stored) => {
        const parsed = Number(stored);
        if (LYRICS_SIZE_OPTIONS.includes(parsed as LyricsTextSize)) {
          setLyricsSize(parsed as LyricsTextSize);
        }
      })
      .catch(() => {});
  }, []);

  const handleQualityChange = async (next: AudioQuality) => {
    setAudioQuality(next);
    try {
      await AsyncStorage.setItem(AUDIO_QUALITY_KEY, next);
    } catch {}
  };

  const handleSeekDurationChange = async (next: SeekDuration) => {
    setSeekDuration(next);
    try {
      await AsyncStorage.setItem(SEEK_DURATION_KEY, String(next));
    } catch {}
  };

  const handleLyricsSizeChange = async (next: LyricsTextSize) => {
    setLyricsSize(next);
    try {
      await AsyncStorage.setItem(LYRICS_SIZE_KEY, String(next));
    } catch {}
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="Playback" />
      </Appbar.Header>

      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="titleSmall" style={[styles.sectionTitle, { color: theme.colors.onSurfaceVariant }]}>
          Audio
        </Text>
        <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <List.Item
            title="Audio quality"
            description={AUDIO_QUALITY_LABELS[audioQuality]}
            onPress={() => setQualityDialogVisible(true)}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
          />
        </View>

        <Text variant="titleSmall" style={[styles.sectionTitle, { color: theme.colors.onSurfaceVariant }]}>
          Controls
        </Text>
        <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <List.Item
            title="Double tap seek duration"
            description={`${seekDuration} seconds`}
            onPress={() => setSeekDialogVisible(true)}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
          />
        </View>

        <Text variant="titleSmall" style={[styles.sectionTitle, { color: theme.colors.onSurfaceVariant }]}>
          Lyrics
        </Text>
        <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <List.Item
            title="Lyrics text size"
            description={LYRICS_SIZE_LABELS[lyricsSize]}
            onPress={() => setLyricsSizeDialogVisible(true)}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
          />
        </View>
      </ScrollView>

      <Portal>
        <Dialog visible={qualityDialogVisible} onDismiss={() => setQualityDialogVisible(false)}>
          <Dialog.Title>Audio quality</Dialog.Title>
          <Dialog.Content>
            <RadioButton.Group
              value={audioQuality}
              onValueChange={(next) => handleQualityChange(next as AudioQuality)}
            >
              <RadioButton.Item label="Low (64 kbps)" value="low" />
              <RadioButton.Item label="Medium (128 kbps)" value="medium" />
              <RadioButton.Item label="High (256 kbps)" value="high" />
              <RadioButton.Item label="Auto (adaptive)" value="auto" />
            </RadioButton.Group>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setQualityDialogVisible(false)}>Done</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Portal>
        <Dialog visible={seekDialogVisible} onDismiss={() => setSeekDialogVisible(false)}>
          <Dialog.Title>Double tap seek duration</Dialog.Title>
          <Dialog.Content>
            <RadioButton.Group
              value={String(seekDuration)}
              onValueChange={(next) => handleSeekDurationChange(Number(next) as SeekDuration)}
            >
              {SEEK_DURATION_OPTIONS.map((duration) => (
                <RadioButton.Item
                  key={duration}
                  label={`${duration} seconds`}
                  value={String(duration)}
                />
              ))}
            </RadioButton.Group>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setSeekDialogVisible(false)}>Done</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Portal>
        <Dialog visible={lyricsSizeDialogVisible} onDismiss={() => setLyricsSizeDialogVisible(false)}>
          <Dialog.Title>Lyrics text size</Dialog.Title>
          <Dialog.Content>
            <RadioButton.Group
              value={String(lyricsSize)}
              onValueChange={(next) => handleLyricsSizeChange(Number(next) as LyricsTextSize)}
            >
              {LYRICS_SIZE_OPTIONS.map((size) => (
                <RadioButton.Item
                  key={size}
                  label={LYRICS_SIZE_LABELS[size]}
                  value={String(size)}
                />
              ))}
            </RadioButton.Group>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setLyricsSizeDialogVisible(false)}>Done</Button>
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
