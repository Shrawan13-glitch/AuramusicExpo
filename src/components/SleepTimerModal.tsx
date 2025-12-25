import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Animated, Dimensions, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface SleepTimerModalProps {
  visible: boolean;
  onClose: () => void;
  onSetTimer: (minutes: number) => void;
  activeTimer: number | null;
  activeTimerSeconds?: number | null;
  onCancelTimer: () => void;
}

const TIMER_OPTIONS = [5, 10, 15, 30, 45, 60];
const { width } = Dimensions.get('window');

export default function SleepTimerModal({ visible, onClose, onSetTimer, activeTimer, activeTimerSeconds, onCancelTimer }: SleepTimerModalProps) {
  const [opacity] = useState(new Animated.Value(0));
  const [scaleAnim] = useState(new Animated.Value(0.8));
  const [showCustom, setShowCustom] = useState(false);
  const [customMinutes, setCustomMinutes] = useState('');
  const [customSeconds, setCustomSeconds] = useState('');

  const getTimeDisplay = (minutes: number | null) => {
    if (!minutes) return { mins: 0, secs: 0 };
    const totalSeconds = Math.round(minutes * 60);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return { mins, secs };
  };

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.8,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
      setShowCustom(false);
      setCustomMinutes('');
      setCustomSeconds('');
    }
  }, [visible]);

  const handleCustomTimer = () => {
    const mins = parseInt(customMinutes) || 0;
    const secs = parseInt(customSeconds) || 0;
    const totalSeconds = mins * 60 + secs;
    const totalMinutes = totalSeconds / 60;
    
    if (totalMinutes > 0) {
      onSetTimer(totalMinutes);
      onClose();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Animated.View style={[styles.overlay, { opacity }]}>
        <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />
        
        <Animated.View style={[styles.modal, { transform: [{ scale: scaleAnim }] }]}>
          <View style={styles.handle} />
          
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Ionicons name="moon" size={32} color="#1db954" />
            </View>
            <Text style={styles.title}>Sleep Timer</Text>
          </View>

          {activeTimer ? (
            <View style={styles.activeTimerSection}>
              <View style={styles.activeTimerCard}>
                <View style={styles.timerCircle}>
                  <Ionicons name="timer-outline" size={40} color="#1db954" />
                </View>
                <Text style={styles.activeTimerLabel}>Timer Active</Text>
                <View style={styles.timerDisplayRow}>
                  {activeTimer && getTimeDisplay(activeTimer).mins > 0 && (
                    <>
                      <Text style={styles.activeTimerTime}>{getTimeDisplay(activeTimer).mins}</Text>
                      <Text style={styles.timerUnit}>min</Text>
                    </>
                  )}
                  <Text style={styles.activeTimerTime}>{String(getTimeDisplay(activeTimer).secs).padStart(2, '0')}</Text>
                  <Text style={styles.timerUnit}>sec</Text>
                </View>
                <Text style={styles.activeTimerSubtext}>remaining</Text>
                <TouchableOpacity 
                  style={styles.cancelButton} 
                  onPress={onCancelTimer}
                  activeOpacity={0.8}
                >
                  <Ionicons name="stop-circle" size={20} color="#fff" />
                  <Text style={styles.cancelButtonText}>Cancel Timer</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <>
              {!showCustom ? (
                <>
                  <Text style={styles.subtitle}>Select when to stop playing</Text>
                  
                  <View style={styles.optionsGrid}>
                    {TIMER_OPTIONS.map((minutes) => (
                      <TouchableOpacity
                        key={minutes}
                        style={styles.optionButton}
                        onPress={() => {
                          onSetTimer(minutes);
                          onClose();
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={styles.optionIconContainer}>
                          <Ionicons name="time-outline" size={28} color="#1db954" />
                        </View>
                        <Text style={styles.optionText}>{minutes}</Text>
                        <Text style={styles.optionUnit}>min</Text>
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity
                      key="custom"
                      style={styles.optionButton}
                      onPress={() => setShowCustom(true)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.optionIconContainer}>
                        <Ionicons name="add-circle-outline" size={28} color="#1db954" />
                      </View>
                      <Text style={styles.optionText}>Custom</Text>
                      <Text style={styles.optionUnit}>time</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <View style={styles.customTimerSection}>
                  <TouchableOpacity 
                    style={styles.backButton}
                    onPress={() => setShowCustom(false)}
                  >
                    <Ionicons name="chevron-back" size={24} color="#1db954" />
                    <Text style={styles.backButtonText}>Back</Text>
                  </TouchableOpacity>

                  <Text style={styles.customTitle}>Custom Timer</Text>
                  
                  <View style={styles.inputGroup}>
                    <View style={styles.inputContainer}>
                      <Text style={styles.inputLabel}>Minutes</Text>
                      <TextInput
                        style={styles.customInput}
                        placeholder="0"
                        placeholderTextColor="#666"
                        keyboardType="number-pad"
                        value={customMinutes}
                        onChangeText={setCustomMinutes}
                        maxLength={3}
                      />
                    </View>
                    
                    <Text style={styles.separator}>:</Text>
                    
                    <View style={styles.inputContainer}>
                      <Text style={styles.inputLabel}>Seconds</Text>
                      <TextInput
                        style={styles.customInput}
                        placeholder="0"
                        placeholderTextColor="#666"
                        keyboardType="number-pad"
                        value={customSeconds}
                        onChangeText={(val) => {
                          const num = parseInt(val) || 0;
                          if (num <= 59) {
                            setCustomSeconds(val);
                          }
                        }}
                        maxLength={2}
                      />
                    </View>
                  </View>

                  <TouchableOpacity 
                    style={styles.setCustomButton}
                    onPress={handleCustomTimer}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="checkmark-circle" size={22} color="#fff" />
                    <Text style={styles.setCustomButtonText}>Set Timer</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modal: {
    backgroundColor: '#0f0f0f',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingBottom: 32,
    paddingTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#333',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 18,
    gap: 8,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(29, 185, 84, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
  },
  subtitle: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginBottom: 16,
    fontWeight: '500',
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 12,
    justifyContent: 'center',
  },
  optionButton: {
    width: (width - 56) / 3,
    aspectRatio: 0.95,
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: 'transparent',
    paddingVertical: 12,
  },

  optionIconContainer: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(29, 185, 84, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  optionUnit: {
    fontSize: 11,
    fontWeight: '600',
    color: '#888',
  },
  activeTimerSection: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  activeTimerCard: {
    width: '100%',
    backgroundColor: 'rgba(29, 185, 84, 0.08)',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(29, 185, 84, 0.3)',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20,
    gap: 8,
  },
  timerCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(29, 185, 84, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(29, 185, 84, 0.4)',
  },
  activeTimerLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  timerDisplayRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    justifyContent: 'center',
  },
  activeTimerTime: {
    fontSize: 36,
    fontWeight: '800',
    color: '#1db954',
  },
  timerUnit: {
    fontSize: 12,
    fontWeight: '600',
    color: '#888',
    marginBottom: 4,
  },
  secondsRow: {
    alignItems: 'center',
  },
  secondsText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#aaa',
  },
  activeTimerSubtext: {
    fontSize: 13,
    fontWeight: '500',
    color: '#aaa',
  },
  cancelButton: {
    flexDirection: 'row',
    backgroundColor: '#ff4757',
    paddingHorizontal: 24,
    paddingVertical: 11,
    borderRadius: 22,
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  customTimerSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1db954',
  },
  customTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 20,
    textAlign: 'center',
  },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
  },
  inputContainer: {
    alignItems: 'center',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#888',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  customInput: {
    width: 70,
    height: 60,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#333',
    fontSize: 28,
    fontWeight: '700',
    color: '#1db954',
    textAlign: 'center',
  },
  separator: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1db954',
    marginBottom: 12,
  },
  setCustomButton: {
    flexDirection: 'row',
    backgroundColor: '#1db954',
    paddingHorizontal: 28,
    paddingVertical: 13,
    borderRadius: 24,
    alignItems: 'center',
    gap: 10,
    alignSelf: 'center',
  },
  setCustomButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000',
  },
});
