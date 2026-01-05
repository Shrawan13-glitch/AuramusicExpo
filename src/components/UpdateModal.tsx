import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Animated, Dimensions, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { UpdateInfo, openUpdateUrl } from '../utils/updateChecker';
import { apkDownloader, DownloadProgress } from '../utils/apkDownloader';

interface UpdateModalProps {
  visible: boolean;
  updateInfo: UpdateInfo;
  onDismiss: () => void;
}

export default function UpdateModal({ visible, updateInfo, onDismiss }: UpdateModalProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadSize, setDownloadSize] = useState('');
  const [downloadSpeed, setDownloadSpeed] = useState('');
  const [showDownloadScreen, setShowDownloadScreen] = useState(false);
  
  const progressAnim = new Animated.Value(0);
  const pulseAnim = new Animated.Value(1);
  const slideAnim = new Animated.Value(0);
  const fadeAnim = new Animated.Value(0);
  const scaleAnim = new Animated.Value(0.8);
  const { width } = Dimensions.get('window');
  
  const isStrict = updateInfo.isStrict === 'true';
  const isAndroid = Platform.OS === 'android';
  
  // Start entrance animations
  React.useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, tension: 100, friction: 8, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 1, duration: 500, useNativeDriver: true })
      ]).start();
    } else {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.8);
      slideAnim.setValue(0);
    }
  }, [visible]);
  
  const handleDownloadAndInstall = async () => {
    // Always use in-app download, never open browser
    setIsDownloading(true);
    setShowDownloadScreen(true);
    
    // Start pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.3, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true })
      ])
    ).start();
    
    let startTime = Date.now();
    
    const success = await apkDownloader.downloadAndInstall(
      updateInfo.downloadUrl,
      (progress: DownloadProgress) => {
        const progressValue = progress.progress;
        setDownloadProgress(progressValue);
        
        // Animate progress bar
        Animated.timing(progressAnim, {
          toValue: progressValue,
          duration: 300,
          useNativeDriver: false
        }).start();
        
        const mbWritten = (progress.bytesWritten / (1024 * 1024)).toFixed(1);
        const mbTotal = (progress.contentLength / (1024 * 1024)).toFixed(1);
        setDownloadSize(`${mbWritten} / ${mbTotal} MB`);
        
        // Calculate download speed
        const elapsed = (Date.now() - startTime) / 1000;
        const speed = (progress.bytesWritten / (1024 * 1024)) / elapsed;
        setDownloadSpeed(`${speed.toFixed(1)} MB/s`);
      }
    );

    setIsDownloading(false);
    setShowDownloadScreen(false);
    if (success && !isStrict) {
      onDismiss();
    }
  };

  return (
    <>
      <Modal visible={visible} transparent animationType="none">
        <Animated.View style={[styles.modernOverlay, { opacity: fadeAnim }]}>
          {/* Blur Background */}
          <View style={styles.blurBackground} />
          
          <Animated.View 
            style={[
              styles.modernContainer,
              {
                transform: [
                  { scale: scaleAnim },
                  { 
                    translateY: slideAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [50, 0]
                    })
                  }
                ]
              }
            ]}
          >
            {/* Material 3 Header */}
            <View style={styles.modernHeader}>
              <Animated.View 
                style={[
                  styles.iconContainer,
                  {
                    transform: [{
                      rotate: slideAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0deg', '360deg']
                      })
                    }]
                  }
                ]}
              >
                <LinearGradient
                  colors={['#6750A4', '#7C4DFF']}
                  style={styles.iconGradient}
                >
                  <Ionicons name="system-update" size={32} color="#fff" />
                </LinearGradient>
              </Animated.View>
              
              <View style={styles.headerText}>
                <Animated.Text 
                  style={[
                    styles.modernTitle,
                    {
                      opacity: slideAnim,
                      transform: [{
                        translateX: slideAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [30, 0]
                        })
                      }]
                    }
                  ]}
                >
                  Update Available
                </Animated.Text>
                <Animated.Text 
                  style={[
                    styles.modernVersion,
                    {
                      opacity: slideAnim,
                      transform: [{
                        translateX: slideAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [30, 0]
                        })
                      }]
                    }
                  ]
                >
                  Version {updateInfo.latestVersion}
                </Animated.Text>
              </View>
            </View>

            {/* Material 3 Content */}
            <Animated.View 
              style={[
                styles.modernContent,
                {
                  opacity: slideAnim,
                  transform: [{
                    translateY: slideAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [20, 0]
                    })
                  }]
                }
              ]}
            >
              <Text style={styles.modernSectionTitle}>What's New</Text>
              <ScrollView style={styles.modernNotesContainer} showsVerticalScrollIndicator={false}>
                {updateInfo.notes.map((note, index) => (
                  <Animated.View 
                    key={index} 
                    style={[
                      styles.modernNoteItem,
                      {
                        opacity: slideAnim,
                        transform: [{
                          translateX: slideAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [20, 0]
                          })
                        }]
                      }
                    ]}
                  >
                    <View style={styles.noteBullet} />
                    <Text style={styles.modernNoteText}>{note}</Text>
                  </Animated.View>
                ))}
              </ScrollView>
            </Animated.View>

            {/* Material 3 Actions */}
            <Animated.View 
              style={[
                styles.modernActions,
                {
                  opacity: slideAnim,
                  transform: [{
                    translateY: slideAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [30, 0]
                    })
                  }]
                }
              ]}
            >
              {!isStrict && !isDownloading && (
                <TouchableOpacity 
                  style={styles.modernSecondaryButton} 
                  onPress={onDismiss}
                  activeOpacity={0.8}
                >
                  <Text style={styles.modernSecondaryButtonText}>Not Now</Text>
                </TouchableOpacity>
              )}
              
              <TouchableOpacity
                style={[styles.modernPrimaryButton, isDownloading && styles.modernDisabledButton]}
                onPress={handleDownloadAndInstall}
                disabled={isDownloading}
                activeOpacity={0.9}
              >
                <LinearGradient
                  colors={isDownloading ? ['#666', '#555'] : ['#6750A4', '#7C4DFF']}
                  style={styles.buttonGradient}
                >
                  {isDownloading && (
                    <Animated.View 
                      style={[
                        styles.loadingSpinner,
                        {
                          transform: [{
                            rotate: progressAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: ['0deg', '360deg']
                            })
                          }]
                        }
                      ]}
                    >
                      <Ionicons name="refresh" size={20} color="#fff" />
                    </Animated.View>
                  )}
                  <Text style={styles.modernPrimaryButtonText}>
                    {isDownloading ? 'Downloading...' : 'Update Now'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          </Animated.View>
        </Animated.View>
      </Modal>

      {/* Ultra Beautiful God-Level Download Screen */}
      <Modal visible={showDownloadScreen} transparent animationType="fade">
        <View style={styles.godDownloadOverlay}>
          {/* Animated Background Gradient */}
          <LinearGradient
            colors={['#0a0a0a', '#1a1a1a', '#0a0a0a']}
            style={StyleSheet.absoluteFillObject}
          />
          
          {/* Floating Particles */}
          <View style={styles.particlesContainer}>
            {[...Array(20)].map((_, i) => (
              <Animated.View
                key={i}
                style={[
                  styles.particle,
                  {
                    left: `${Math.random() * 100}%`,
                    top: `${Math.random() * 100}%`,
                    opacity: progressAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.2, 0.8]
                    })
                  }
                ]}
              />
            ))}
          </View>

          <View style={styles.godDownloadContainer}>
            {/* Mega Animated Download Icon */}
            <Animated.View style={[styles.godIconContainer, { transform: [{ scale: pulseAnim }] }]}>
              <LinearGradient
                colors={['#00ff88', '#1db954', '#00cc66']}
                style={styles.godIconGradient}
              >
                <View style={styles.iconGlow} />
                <Ionicons name="cloud-download" size={80} color="#fff" />
                <View style={styles.iconRipple} />
              </LinearGradient>
            </Animated.View>

            {/* Ultra Title */}
            <Animated.Text 
              style={[
                styles.godDownloadTitle,
                {
                  opacity: progressAnim.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [0.7, 1, 0.9]
                  })
                }
              ]}
            >
              DOWNLOADING UPDATE
            </Animated.Text>
            
            <Text style={styles.godDownloadSubtitle}>
              Preparing the ultimate experience...
            </Text>

            {/* God-Level Progress Circle */}
            <View style={styles.godProgressContainer}>
              <View style={styles.godProgressCircle}>
                {/* Rotating Progress Ring */}
                <Animated.View 
                  style={[
                    styles.godProgressRing,
                    {
                      transform: [{
                        rotate: progressAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0deg', '360deg']
                        })
                      }]
                    }
                  ]}
                />
                
                {/* Inner Glow */}
                <View style={styles.godProgressInner}>
                  <LinearGradient
                    colors={['#00ff88', '#1db954']}
                    style={styles.progressGlow}
                  >
                    <Text style={styles.godProgressText}>
                      {Math.round(downloadProgress * 100)}%
                    </Text>
                  </LinearGradient>
                </View>
                
                {/* Outer Glow Ring */}
                <Animated.View 
                  style={[
                    styles.outerGlowRing,
                    {
                      opacity: progressAnim.interpolate({
                        inputRange: [0, 0.5, 1],
                        outputRange: [0.3, 0.8, 0.5]
                      })
                    }
                  ]}
                />
              </View>
            </View>

            {/* Ultra Progress Bar */}
            <View style={styles.godProgressBarContainer}>
              <View style={styles.godProgressBarBg}>
                <Animated.View 
                  style={[
                    styles.godProgressBarFill,
                    {
                      width: progressAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', '100%']
                      })
                    }
                  ]}
                >
                  <LinearGradient
                    colors={['#00ff88', '#1db954', '#00cc66']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={StyleSheet.absoluteFillObject}
                  />
                  <View style={styles.progressBarGlow} />
                </Animated.View>
              </View>
            </View>

            {/* Ultra Download Stats */}
            <View style={styles.godDownloadStats}>
              <View style={styles.godStatItem}>
                <LinearGradient
                  colors={['#00ff88', '#1db954']}
                  style={styles.statIconBg}
                >
                  <Ionicons name="archive" size={20} color="#fff" />
                </LinearGradient>
                <Text style={styles.godStatText}>{downloadSize}</Text>
              </View>
              
              <View style={styles.godStatItem}>
                <LinearGradient
                  colors={['#00ff88', '#1db954']}
                  style={styles.statIconBg}
                >
                  <Ionicons name="flash" size={20} color="#fff" />
                </LinearGradient>
                <Text style={styles.godStatText}>{downloadSpeed}</Text>
              </View>
            </View>

            {/* Ultra Animated Status Dots */}
            <View style={styles.godDotsContainer}>
              {[0, 1, 2, 3, 4].map((i) => (
                <Animated.View
                  key={i}
                  style={[
                    styles.godDot,
                    {
                      opacity: progressAnim.interpolate({
                        inputRange: [0, 0.2, 0.4, 0.6, 0.8, 1],
                        outputRange: i === 0 ? [1, 0.3, 0.3, 0.3, 0.3, 1] : 
                                    i === 1 ? [0.3, 1, 0.3, 0.3, 0.3, 0.3] :
                                    i === 2 ? [0.3, 0.3, 1, 0.3, 0.3, 0.3] :
                                    i === 3 ? [0.3, 0.3, 0.3, 1, 0.3, 0.3] :
                                               [0.3, 0.3, 0.3, 0.3, 1, 0.3]
                      }),
                      transform: [{
                        scale: progressAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.8, 1.2]
                        })
                      }]
                    }
                  ]}
                >
                  <LinearGradient
                    colors={['#00ff88', '#1db954']}
                    style={styles.dotGradient}
                  />
                </Animated.View>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  container: { backgroundColor: '#1a1a1a', borderRadius: 16, width: '100%', maxWidth: 400, maxHeight: '80%' },
  header: { alignItems: 'center', padding: 24, borderBottomWidth: 1, borderBottomColor: '#333' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginTop: 16 },
  version: { fontSize: 16, color: '#aaa', marginTop: 4 },
  notesContainer: { maxHeight: 300, padding: 20 },
  notesTitle: { fontSize: 18, fontWeight: '600', color: '#fff', marginBottom: 12 },
  noteItem: { flexDirection: 'row', marginBottom: 8 },
  bullet: { fontSize: 16, color: '#1db954', marginRight: 8 },
  noteText: { fontSize: 16, color: '#ddd', flex: 1 },
  buttons: { padding: 20, gap: 12 },
  updateButton: { backgroundColor: '#1db954', padding: 16, borderRadius: 8, alignItems: 'center' },
  updateButtonText: { fontSize: 16, fontWeight: 'bold', color: '#000' },
  laterButton: { padding: 16, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#666' },
  laterButtonText: { fontSize: 16, color: '#fff' },
  disabledButton: { opacity: 0.6 },
  
  // God-Level Ultra Beautiful Download Screen
  godDownloadOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  particlesContainer: { position: 'absolute', width: '100%', height: '100%' },
  particle: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#00ff88',
    shadowColor: '#00ff88',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4
  },
  
  godDownloadContainer: { alignItems: 'center', paddingHorizontal: 40, zIndex: 10 },
  
  godIconContainer: { marginBottom: 40, position: 'relative' },
  godIconGradient: {
    width: 160,
    height: 160,
    borderRadius: 80,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#00ff88',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.8,
    shadowRadius: 40,
    elevation: 30,
    position: 'relative'
  },
  iconGlow: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#00ff88',
    opacity: 0.2,
    top: -20,
    left: -20
  },
  iconRipple: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    borderWidth: 2,
    borderColor: '#00ff88',
    opacity: 0.3,
    top: -40,
    left: -40
  },
  
  godDownloadTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: '#fff',
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: 2,
    textShadowColor: '#00ff88',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8
  },
  godDownloadSubtitle: {
    fontSize: 18,
    color: '#aaa',
    marginBottom: 50,
    textAlign: 'center',
    lineHeight: 24,
    fontWeight: '500'
  },
  
  godProgressContainer: { marginBottom: 40, position: 'relative' },
  godProgressCircle: {
    width: 180,
    height: 180,
    borderRadius: 90,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative'
  },
  godProgressRing: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 12,
    borderColor: 'transparent',
    borderTopColor: '#00ff88',
    borderRightColor: '#1db954',
    shadowColor: '#00ff88',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 20
  },
  godProgressInner: {
    width: 140,
    height: 140,
    borderRadius: 70,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
    borderWidth: 2,
    borderColor: '#333'
  },
  progressGlow: {
    width: '100%',
    height: '100%',
    borderRadius: 68,
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.1
  },
  godProgressText: {
    fontSize: 28,
    fontWeight: '900',
    color: '#00ff88',
    textShadowColor: '#00ff88',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10
  },
  outerGlowRing: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 1,
    borderColor: '#00ff88',
    top: -20,
    left: -20
  },
  
  godProgressBarContainer: { width: '100%', marginBottom: 40 },
  godProgressBarBg: {
    height: 12,
    backgroundColor: '#1a1a1a',
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#333'
  },
  godProgressBarFill: {
    height: '100%',
    borderRadius: 6,
    position: 'relative',
    shadowColor: '#00ff88',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 12
  },
  progressBarGlow: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    backgroundColor: '#00ff88',
    borderRadius: 10,
    opacity: 0.3
  },
  
  godDownloadStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 40
  },
  godStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(0,255,136,0.1)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: 'rgba(0,255,136,0.3)'
  },
  statIconBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center'
  },
  godStatText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '700'
  },
  
  godDotsContainer: {
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'center'
  },
  godDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    overflow: 'hidden'
  },
  dotGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 8
  },
});
