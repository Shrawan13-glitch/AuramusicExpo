import React, { useCallback, useEffect, useState } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import MiniPlayer from './MiniPlayer';
import PlayerScreen from '../screens/PlayerScreen';
import { usePlayer } from '../contexts/PlayerContext';

interface MusicControllerProps {
  bottomOffset?: number;
  activeRouteName?: string;
}

const MusicController = React.memo(({ bottomOffset = 0, activeRouteName }: MusicControllerProps) => {
  const { currentTrack } = usePlayer();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [isLyricsOpen, setIsLyricsOpen] = useState(false);
  const progress = useSharedValue(0); // 0 = mini, 1 = expanded
  const startProgress = useSharedValue(0);

  const expand = useCallback(() => {
    if (isExpanded) return;
    setIsExpanded(true);
    progress.value = withTiming(1, { duration: 240 });
  }, [isExpanded, progress]);

  const collapse = useCallback(() => {
    if (!isExpanded) return;
    progress.value = withTiming(0, { duration: 220 }, (finished) => {
      if (finished) {
        runOnJS(setIsExpanded)(false);
      }
    });
  }, [isExpanded, progress]);

  useEffect(() => {
    if (!currentTrack) {
      setIsExpanded(false);
      setIsQueueOpen(false);
      setIsLyricsOpen(false);
      progress.value = 0;
    }
  }, [currentTrack, progress]);

  useEffect(() => {
    if (activeRouteName === 'Player' || activeRouteName === 'Queue') {
      setIsExpanded(false);
      setIsQueueOpen(false);
      setIsLyricsOpen(false);
      progress.value = 0;
    }
  }, [activeRouteName, progress]);

  useEffect(() => {
    if (!isExpanded || isQueueOpen || isLyricsOpen) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      collapse();
      return true;
    });
    return () => sub.remove();
  }, [collapse, isExpanded, isLyricsOpen, isQueueOpen]);

  const miniGesture = Gesture.Pan()
    .enabled(!isExpanded)
    .activeOffsetY([-8, 8])
    .onBegin(() => {
      startProgress.value = progress.value;
    })
    .onUpdate((event) => {
      const next = Math.min(Math.max(startProgress.value + (-event.translationY / 220), 0), 1);
      progress.value = next;
    })
    .onEnd((event) => {
      const shouldExpand = progress.value > 0.45 || event.velocityY < -700;
      if (shouldExpand) {
        runOnJS(expand)();
      } else {
        progress.value = withTiming(0, { duration: 160 });
      }
    });

  const expandedGesture = Gesture.Pan()
    .enabled(isExpanded && !isQueueOpen && !isLyricsOpen)
    .activeOffsetY([-8, 8])
    .onBegin(() => {
      startProgress.value = progress.value;
    })
    .onUpdate((event) => {
      const next = Math.min(Math.max(startProgress.value - (event.translationY / 320), 0), 1);
      progress.value = next;
    })
    .onEnd((event) => {
      const shouldCollapse = progress.value < 0.55 || event.velocityY > 700;
      if (shouldCollapse) {
        runOnJS(collapse)();
      } else {
        progress.value = withTiming(1, { duration: 160 });
      }
    });

  const miniStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [1, 0], Extrapolation.CLAMP),
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [0, 16], Extrapolation.CLAMP) },
      { scale: interpolate(progress.value, [0, 1], [1, 0.985], Extrapolation.CLAMP) },
    ],
  }));

  const expandedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(progress.value, [0, 1], [24, 0], Extrapolation.CLAMP) }],
  }));

  if (!currentTrack || activeRouteName === 'Player' || activeRouteName === 'Queue') {
    return null;
  }

  return (
    <View pointerEvents="box-none" style={styles.overlay}>
      <GestureDetector gesture={expandedGesture}>
        <Animated.View style={[styles.expanded, expandedStyle]} pointerEvents={isExpanded ? 'auto' : 'none'}>
          <PlayerScreen
            onCollapse={collapse}
            onQueueVisibilityChange={setIsQueueOpen}
            onLyricsVisibilityChange={setIsLyricsOpen}
          />
        </Animated.View>
      </GestureDetector>

      <GestureDetector gesture={miniGesture}>
        <Animated.View style={[styles.mini, miniStyle]} pointerEvents={isExpanded ? 'none' : 'auto'}>
          <MiniPlayer onExpand={expand} bottomOffset={bottomOffset} />
        </Animated.View>
      </GestureDetector>
    </View>
  );
});

export default MusicController;

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
    zIndex: 1000,
  },
  mini: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  expanded: {
    ...StyleSheet.absoluteFillObject,
  },
});
