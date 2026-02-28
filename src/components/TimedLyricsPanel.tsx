import React, { memo, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Text, useTheme } from 'react-native-paper';
import type { TimedLyricLine } from '../types/lyrics';
import { findActiveLyricIndex } from '../utils/lyricsParser';

interface TimedLyricsPanelProps {
  lines: TimedLyricLine[];
  timed: boolean;
  positionSec: number;
  visible: boolean;
}

const ESTIMATED_ROW_HEIGHT = 38;

function TimedLyricsPanelImpl({ lines, timed, positionSec, visible }: TimedLyricsPanelProps) {
  const theme = useTheme();
  const listRef = useRef<FlashList<TimedLyricLine>>(null);
  const activeIndex = useMemo(() => {
    if (!timed) return -1;
    return findActiveLyricIndex(lines, positionSec + 0.08);
  }, [lines, positionSec, timed]);
  const prevIndexRef = useRef(-1);

  useEffect(() => {
    if (!visible || !timed || activeIndex < 0) return;
    if (activeIndex === prevIndexRef.current) return;
    prevIndexRef.current = activeIndex;

    listRef.current?.scrollToIndex({
      index: activeIndex,
      animated: true,
      viewPosition: 0.5,
    });
  }, [activeIndex, timed, visible]);

  const renderItem = ({ item, index }: { item: TimedLyricLine; index: number }) => {
    const isActive = timed && index === activeIndex;
    return (
      <View style={styles.lineWrap}>
        <Text
          variant={isActive ? 'titleMedium' : 'bodyLarge'}
          style={[
            styles.line,
            {
              color: isActive ? theme.colors.onBackground : theme.colors.onSurfaceVariant,
              opacity: isActive ? 1 : 0.62,
            },
          ]}
        >
          {item.text}
        </Text>
      </View>
    );
  };

  return (
    <View style={[styles.container, { borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(0,0,0,0.18)' }]}> 
      <FlashList
        ref={listRef}
        data={lines}
        renderItem={renderItem}
        keyExtractor={(item, index) => `${index}-${Math.round(item.timeSec * 1000)}`}
        estimatedItemSize={ESTIMATED_ROW_HEIGHT}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
        ListHeaderComponent={<View style={styles.edgeSpacer} />}
        ListFooterComponent={<View style={styles.edgeSpacer} />}
      />
    </View>
  );
}

export default memo(TimedLyricsPanelImpl);

const styles = StyleSheet.create({
  container: {
    height: 220,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    marginHorizontal: 20,
    marginBottom: 20,
  },
  contentContainer: {
    paddingHorizontal: 16,
  },
  edgeSpacer: {
    height: 90,
  },
  lineWrap: {
    minHeight: 38,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 5,
  },
  line: {
    textAlign: 'center',
  },
});
