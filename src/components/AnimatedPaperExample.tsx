import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Button, Card, Text } from 'react-native-paper';
import Animated, {
  useSharedValue,
  withTiming,
  useAnimatedStyle,
  Easing,
} from 'react-native-reanimated';

export const AnimatedPaperExample: React.FC = () => {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const config = {
    duration: 300,
    easing: Easing.bezier(0.5, 0.01, 0, 1),
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withTiming(scale.value, config) }],
    opacity: withTiming(opacity.value, config),
  }));

  const handlePress = () => {
    scale.value = scale.value === 1 ? 1.1 : 1;
    opacity.value = opacity.value === 1 ? 0.8 : 1;
  };

  return (
    <View style={styles.container}>
      <Animated.View style={animatedStyle}>
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="headlineSmall">AuraMusic</Text>
            <Text variant="bodyMedium">Reanimated + Paper Integration</Text>
          </Card.Content>
        </Card>
      </Animated.View>
      <Button mode="contained" onPress={handlePress} style={styles.button}>
        Animate Card
      </Button>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: 300,
    marginBottom: 20,
  },
  button: {
    marginTop: 10,
  },
});