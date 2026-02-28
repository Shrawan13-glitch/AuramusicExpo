import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { FlashList } from '@shopify/flash-list';
import { IconButton, Surface, Text, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { LyricsPayload, LyricsStatus } from '../types/lyrics';
import { findActiveLyricIndex } from '../utils/lyricsParser';

interface LyricsScreenProps {
  title: string;
  artist: string;
  lyricsStatus: LyricsStatus;
  lyricsPayload: LyricsPayload | null;
  position: number;
  duration: number;
  isPlaying: boolean;
  onSeek: (value: number) => void;
  onSkipPrevious: () => void;
  onSkipNext: () => void;
  onPauseResume: () => void;
  onClose: () => void;
}

const ESTIMATED_ITEM_SIZE = 48;
const LYRICS_SIZE_KEY = 'lyrics_text_size';

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export default function LyricsScreen({
  title,
  artist,
  lyricsStatus,
  lyricsPayload,
  position,
  duration,
  isPlaying,
  onSeek,
  onSkipPrevious,
  onSkipNext,
  onPauseResume,
  onClose,
}: LyricsScreenProps) {
  const theme = useTheme();
  const listRef = useRef<FlashList<{ timeSec: number; text: string }>>(null);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekPosition, setSeekPosition] = useState(0);
  const [textSize, setTextSize] = useState(1);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(LYRICS_SIZE_KEY)
      .then((stored) => {
        const parsed = Number(stored);
        if ([0.85, 1, 1.15, 1.3].includes(parsed)) {
          setTextSize(parsed);
        }
      })
      .catch(() => {});
  }, []);

  const lines = lyricsPayload?.lines || [];
  const isTimed = !!lyricsPayload?.timed;

  const activeIndex = useMemo(() => {
    if (!isTimed || !lines.length) return -1;
    return findActiveLyricIndex(lines, position + 0.5);
  }, [isTimed, lines, position]);

  const prevIndexRef = useRef(-1);
  const isScrollingRef = useRef(false);
  
  useEffect(() => {
    if (!isTimed || activeIndex < 0 || isUserScrolling) return;
    if (prevIndexRef.current === activeIndex) return;
    if (isScrollingRef.current) return;
    
    prevIndexRef.current = activeIndex;
    isScrollingRef.current = true;

    listRef.current?.scrollToIndex({
      index: activeIndex,
      animated: true,
      viewPosition: 0.4,
    });
    
    setTimeout(() => {
      isScrollingRef.current = false;
    }, 300);
  }, [activeIndex, isTimed, isUserScrolling]);

  const handleUserScroll = () => {
    setIsUserScrolling(true);
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
  };

  const handleResync = () => {
    setIsUserScrolling(false);
    if (activeIndex >= 0) {
      listRef.current?.scrollToIndex({
        index: activeIndex,
        animated: true,
        viewPosition: 0.4,
      });
    }
  };

  const handleLinePress = (timeSec: number) => {
    onSeek(timeSec);
    setIsUserScrolling(false);
  };

  const renderLyricsContent = () => {
    if (lyricsStatus === 'loading') {
      return (
        <View style={styles.placeholderWrap}>
          <Text variant="titleMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            Fetching lyrics...
          </Text>
        </View>
      );
    }

    if (lyricsStatus === 'error') {
      return (
        <View style={styles.placeholderWrap}>
          <Text variant="titleMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            Could not load lyrics.
          </Text>
        </View>
      );
    }

    if (!lines.length) {
      return (
        <View style={styles.placeholderWrap}>
          <Text variant="titleMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            No lyrics found.
          </Text>
        </View>
      );
    }

    return (
      <FlashList
        ref={listRef}
        data={lines}
        estimatedItemSize={ESTIMATED_ITEM_SIZE}
        keyExtractor={(item, index) => `${index}-${item.timeSec}`}
        contentContainerStyle={styles.lyricsContent}
        ListHeaderComponent={<View style={styles.edgeSpacer} />}
        ListFooterComponent={<View style={styles.edgeSpacer} />}
        showsVerticalScrollIndicator={false}
        decelerationRate="fast"
        overScrollMode="never"
        onScrollBeginDrag={handleUserScroll}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={50}
        windowSize={11}
        renderItem={({ item, index }) => {
          const isActive = isTimed && index === activeIndex;
          const isPast = isTimed && index < activeIndex;
          const activeFontSize = 22 * textSize;
          const inactiveFontSize = 18 * textSize;
          return (
            <View style={styles.lineRow}>
              <Text
                onPress={() => isTimed && handleLinePress(item.timeSec)}
                style={[
                  styles.lineText,
                  {
                    fontSize: isActive ? activeFontSize : inactiveFontSize,
                    color: isActive ? '#ffffff' : isPast ? '#888888' : '#cccccc',
                    opacity: isActive ? 1 : isPast ? 0.4 : 0.65,
                    fontWeight: isActive ? '700' : '400',
                  },
                ]}
              >
                {item.text}
              </Text>
            </View>
          );
        }}
      />
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#1a1625', '#0f0d15', '#000000']}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <Surface style={styles.header} elevation={0}>
        <IconButton icon="chevron-down" size={28} iconColor={theme.colors.onSurface} onPress={onClose} />
        <View style={styles.headerCenter}>
          <Text variant="labelLarge" numberOfLines={1} style={[styles.headerTitle, { color: theme.colors.onSurface }]}>
            Lyrics
          </Text>
        </View>
        {isUserScrolling && isTimed ? (
          <IconButton icon="sync" size={24} iconColor={theme.colors.primary} onPress={handleResync} />
        ) : (
          <View style={styles.headerRightSpacer} />
        )}
      </Surface>

      <View style={styles.trackCard}>
        <Surface style={[styles.trackCardSurface, { backgroundColor: 'rgba(255,255,255,0.08)' }]} elevation={2}>
          <Text numberOfLines={1} variant="titleLarge" style={{ color: theme.colors.onSurface, fontWeight: '600' }}>
            {title}
          </Text>
          <Text numberOfLines={1} variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
            {artist}
          </Text>
        </Surface>
      </View>

      <View style={styles.lyricsBody}>{renderLyricsContent()}</View>

      <BlurView intensity={80} tint="dark" style={styles.bottomSheet}>
        <View style={styles.bottomSheetContent}>
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={duration || 0}
            value={isSeeking ? seekPosition : Math.max(0, Math.min(position, duration || 0))}
            onSlidingStart={(value) => {
              setIsSeeking(true);
              setSeekPosition(value);
            }}
            onValueChange={setSeekPosition}
            onSlidingComplete={(value) => {
              setIsSeeking(false);
              onSeek(value);
            }}
            minimumTrackTintColor={theme.colors.primary}
            maximumTrackTintColor="rgba(255,255,255,0.2)"
            thumbStyle={[styles.thumb, { backgroundColor: theme.colors.primary }]}
          />
          <View style={styles.timeRow}>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurface, fontWeight: '500' }}>
              {formatTime(isSeeking ? seekPosition : position)}
            </Text>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              {formatTime(duration)}
            </Text>
          </View>

          <View style={styles.controlsRow}>
            <IconButton icon="skip-previous" size={32} iconColor={theme.colors.onSurface} onPress={onSkipPrevious} />
            <Surface style={[styles.playButton, { backgroundColor: theme.colors.primary }]} elevation={6}>
              <IconButton
                icon={isPlaying ? 'pause' : 'play'}
                size={32}
                iconColor={theme.colors.onPrimary}
                onPress={onPauseResume}
                style={styles.playButtonInner}
              />
            </Surface>
            <IconButton icon="skip-next" size={32} iconColor={theme.colors.onSurface} onPress={onSkipNext} />
          </View>
        </View>
      </BlurView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    marginTop: 8,
    backgroundColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    letterSpacing: 1.2,
    fontWeight: '600',
  },
  headerRightSpacer: {
    width: 48,
  },
  trackCard: {
    paddingHorizontal: 20,
    marginTop: 12,
  },
  trackCardSurface: {
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  lyricsBody: {
    flex: 1,
    marginTop: 16,
  },
  lyricsContent: {
    paddingHorizontal: 24,
  },
  edgeSpacer: {
    height: 120,
  },
  lineRow: {
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  lineText: {
    textAlign: 'center',
    lineHeight: 32,
  },
  placeholderWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  bottomSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  bottomSheetContent: {
    paddingHorizontal: 28,
    paddingTop: 20,
    paddingBottom: 28,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  thumb: {
    width: 18,
    height: 18,
    borderRadius: 9,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -4,
    marginBottom: 12,
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    gap: 32,
  },
  playButton: {
    borderRadius: 36,
    width: 72,
    height: 72,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButtonInner: {
    margin: 0,
  },
});
