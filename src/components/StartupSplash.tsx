import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

const BRAND_TEXT = 'Mediyo';

interface StartupSplashProps {
  isClosing?: boolean;
  onCloseComplete?: () => void;
}

export default function StartupSplash({ isClosing = false, onCloseComplete }: StartupSplashProps) {
  const [typedLength, setTypedLength] = useState(0);
  const [cursorVisible, setCursorVisible] = useState(true);
  const logoScale = useRef(new Animated.Value(1)).current;
  const overlayOpacity = useRef(new Animated.Value(1)).current;
  const textOpacity = useRef(new Animated.Value(1)).current;
  const hasStartedCloseRef = useRef(false);

  useEffect(() => {
    const typingTimer = setInterval(() => {
      setTypedLength((prev) => (prev < BRAND_TEXT.length ? prev + 1 : prev));
    }, 85);

    const cursorTimer = setInterval(() => {
      setCursorVisible((prev) => !prev);
    }, 500);

    return () => {
      clearInterval(typingTimer);
      clearInterval(cursorTimer);
    };
  }, []);

  const typedText = useMemo(() => BRAND_TEXT.slice(0, typedLength), [typedLength]);

  useEffect(() => {
    if (!isClosing || hasStartedCloseRef.current) return;
    hasStartedCloseRef.current = true;

    Animated.parallel([
      Animated.timing(textOpacity, {
        toValue: 0,
        duration: 180,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(logoScale, {
        toValue: 9,
        duration: 560,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 560,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        onCloseComplete?.();
      }
    });
  }, [isClosing, logoScale, onCloseComplete, overlayOpacity, textOpacity]);

  return (
    <Animated.View style={[styles.container, { opacity: overlayOpacity }]}>
      <Animated.View style={{ transform: [{ scale: logoScale }] }}>
        <Image source={require('../../assets/icon.png')} style={styles.logo} resizeMode="contain" />
      </Animated.View>
      <Animated.View style={{ opacity: textOpacity }}>
        <Text variant="headlineSmall" style={styles.title} selectable={false}>
          {typedText}
          <Text style={styles.cursor}>{cursorVisible ? '_' : ' '}</Text>
        </Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0f19',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 112,
    height: 112,
    borderRadius: 24,
  },
  title: {
    marginTop: 18,
    color: '#f3f4f6',
    fontWeight: '600',
    letterSpacing: 0.2,
    minWidth: 135,
    textAlign: 'left',
  },
  cursor: { color: '#9ca3af' },
});
