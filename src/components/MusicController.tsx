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

interface MusicControllerProps {
  bottomOffset?: number;
  activeRouteName?: string;
}

const MusicController = React.memo(({ bottomOffset = 0, activeRouteName }: MusicControllerProps) => {
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

  const panGesture = Gesture.Pan()
    .activeOffsetY([-8, 8])
    .onBegin(() => {
      dragStartY.value = translateY.value;
    })
    .onUpdate((event) => {
      const next = Math.min(Math.max(dragStartY.value + event.translationY, 0), collapsedOffset);
      translateY.value = next;
    })
    .onEnd((event) => {
      const shouldExpand = event.translationY < 0 || event.velocityY < 0;
      if (shouldExpand) {
        runOnJS(handleExpand)();
      } else {
        runOnJS(handleCollapse)();
      }
    });

  const playerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: interpolate(translateY.value, [0, collapsedOffset], [1, 0], Extrapolation.CLAMP),
  }));

  const miniStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateY.value, [0, collapsedOffset], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(translateY.value, [0, collapsedOffset], [40, 0], Extrapolation.CLAMP) }],
  }));

  return (
    <View pointerEvents="box-none" style={styles.overlay}>
      <GestureDetector gesture={panGesture.enabled(isExpanded)}>
        <Animated.View
          style={[styles.expanded, playerStyle]}
          entering={FadeIn}
          exiting={FadeOut}
          pointerEvents={isExpanded ? 'auto' : 'none'}
        >
          <PlayerScreen onCollapse={handleCollapse} />
        </Animated.View>
      </GestureDetector>
      <GestureDetector gesture={panGesture.enabled(!isExpanded)}>
        <Animated.View
          style={[styles.collapsed, miniStyle]}
          entering={FadeIn}
          exiting={FadeOut}
          onLayout={(event) => setMiniHeight(event.nativeEvent.layout.height)}
          pointerEvents={isExpanded ? 'none' : 'auto'}
        >
          <MiniPlayer onExpand={handleExpand} bottomOffset={bottomOffset} />
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
  collapsed: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
});
