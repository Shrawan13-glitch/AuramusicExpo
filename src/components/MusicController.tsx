import React, { useState, useCallback, useEffect } from 'react';
import { BackHandler, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
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
  const [miniHeight, setMiniHeight] = useState(0);
  const { height: screenHeight } = useWindowDimensions();
  const translateY = useSharedValue(0);
  const dragStartY = useSharedValue(0);

  const collapsedOffset = Math.max(screenHeight - (miniHeight || 120), 0);

  const handleExpand = useCallback(() => {
    setIsExpanded(true);
    translateY.value = withSpring(0, { damping: 26, stiffness: 320, mass: 0.9 });
  }, [translateY]);

  const handleCollapse = useCallback(() => {
    setIsExpanded(false);
    translateY.value = withSpring(collapsedOffset, { damping: 26, stiffness: 320, mass: 0.9 });
  }, [collapsedOffset, translateY]);

  useEffect(() => {
    if (!isExpanded) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      handleCollapse();
      return true;
    });
    return () => subscription.remove();
  }, [handleCollapse, isExpanded]);

  const lastRouteNameRef = React.useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!activeRouteName) return;
    const previousRoute = lastRouteNameRef.current;
    lastRouteNameRef.current = activeRouteName;

    if (!isExpanded || !previousRoute) return;
    if (activeRouteName !== previousRoute && activeRouteName !== 'Main') {
      handleCollapse();
    }
  }, [activeRouteName, handleCollapse, isExpanded]);

  useEffect(() => {
    if (!isExpanded) {
      translateY.value = collapsedOffset;
    }
  }, [collapsedOffset, isExpanded, translateY]);

  const settleGesture = useCallback((shouldExpand: boolean) => {
    if (shouldExpand) {
      handleExpand();
    } else {
      handleCollapse();
    }
  }, [handleCollapse, handleExpand]);

  const panGestureExpanded = Gesture.Pan()
    .activeOffsetY([-8, 8])
    .onBegin(() => {
      dragStartY.value = translateY.value;
    })
    .onUpdate((event) => {
      const next = Math.min(Math.max(dragStartY.value + event.translationY, 0), collapsedOffset);
      translateY.value = next;
    })
    .onEnd((event) => {
      const collapseThreshold = Math.min(160, collapsedOffset * 0.25);
      const shouldCollapse = event.translationY > collapseThreshold || event.velocityY > 800;
      runOnJS(settleGesture)(!shouldCollapse);
    });

  const panGestureCollapsed = Gesture.Pan()
    .activeOffsetY([-8, 8])
    .onBegin(() => {
      dragStartY.value = translateY.value;
    })
    .onUpdate((event) => {
      const next = Math.min(Math.max(dragStartY.value + event.translationY, 0), collapsedOffset);
      translateY.value = next;
    })
    .onEnd((event) => {
      const expandThreshold = Math.min(160, collapsedOffset * 0.25);
      const shouldExpand = event.translationY < -expandThreshold || event.velocityY < -800;
      runOnJS(settleGesture)(shouldExpand);
    });

  const playerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: interpolate(translateY.value, [0, collapsedOffset], [1, 0], Extrapolation.CLAMP),
  }));

  const miniStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateY.value, [0, collapsedOffset], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(translateY.value, [0, collapsedOffset], [40, 0], Extrapolation.CLAMP) }],
  }));

  if (!currentTrack) {
    return null;
  }

  return (
    <View pointerEvents="box-none" style={styles.overlay}>
      <GestureDetector gesture={panGestureExpanded.enabled(isExpanded)}>
        <Animated.View
          style={styles.expanded}
          entering={FadeIn}
          exiting={FadeOut}
          pointerEvents={isExpanded ? 'auto' : 'none'}
        >
          <Animated.View style={[styles.expandedFill, playerStyle]}>
            <PlayerScreen onCollapse={handleCollapse} />
          </Animated.View>
        </Animated.View>
      </GestureDetector>
      <GestureDetector gesture={panGestureCollapsed.enabled(!isExpanded)}>
        <Animated.View
          style={styles.collapsed}
          entering={FadeIn}
          exiting={FadeOut}
          onLayout={(event) => setMiniHeight(event.nativeEvent.layout.height)}
          pointerEvents={isExpanded ? 'none' : 'auto'}
        >
          <Animated.View style={miniStyle}>
            <MiniPlayer onExpand={handleExpand} bottomOffset={bottomOffset} />
          </Animated.View>
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
  expanded: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  expandedFill: {
    flex: 1,
  },
  collapsed: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
});
