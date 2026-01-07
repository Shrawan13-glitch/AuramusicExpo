import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated, Dimensions, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { UpdateInfoV2, SelectedDownload, openUpdateUrl } from '../utils/updateCheckerV2';
import { apkDownloader, DownloadProgress, DownloadError } from '../utils/apkDownloader';

interface UpdateScreenProps {
  route: any;
  navigation: any;
}

export default function UpdateScreen({ route, navigation }: UpdateScreenProps) {
  const updateInfo: UpdateInfoV2 = route.params?.updateInfo;
  const selectedDownload: SelectedDownload = route.params?.selectedDownload;
  const isStrict = updateInfo?.isStrict === 'true';
  
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadSize, setDownloadSize] = useState('');
  const [downloadSpeed, setDownloadSpeed] = useState('');
  const [timeRemaining, setTimeRemaining] = useState('');
  const [showDownloadScreen, setShowDownloadScreen] = useState(false);
  const [downloadComplete, setDownloadComplete] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [error, setError] = useState<DownloadError | null>(null);
  const [fileSize, setFileSize] = useState('');
  const [isPaused, setIsPaused] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  
  const fadeAnim = new Animated.Value(1); // Start visible
  const scaleAnim = new Animated.Value(1); // Start at normal scale
  const slideAnim = new Animated.Value(1); // Start in position
  const pulseAnim = new Animated.Value(1);
  
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, tension: 80, friction: 8, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 1, duration: 800, useNativeDriver: true })
    ]).start();

    // Get file size on mount
    if (updateInfo?.downloadUrl) {
      apkDownloader.getFileSize(updateInfo.downloadUrl).then(size => {
        if (size > 0) {
          const mb = (size / (1024 * 1024)).toFixed(1);
          setFileSize(`${mb} MB`);
        }
      });
    }
  }, []);

  const handleDownloadAndInstall = async () => {
    setError(null);
    setIsDownloading(true);
    setShowDownloadScreen(true);
    
    const success = await apkDownloader.downloadAndInstall(
      selectedDownload.url,
      (progress: DownloadProgress) => {
        setDownloadProgress(progress.progress);
        
        const mbWritten = (progress.bytesWritten / (1024 * 1024)).toFixed(1);
        const mbTotal = (progress.contentLength / (1024 * 1024)).toFixed(1);
        setDownloadSize(`${mbWritten} / ${mbTotal} MB`);
        setDownloadSpeed(`${progress.speed.toFixed(1)} MB/s`);
        
        if (progress.timeRemaining > 0 && progress.timeRemaining < 3600) {
          const minutes = Math.floor(progress.timeRemaining / 60);
          const seconds = Math.floor(progress.timeRemaining % 60);
          setTimeRemaining(`${minutes}:${seconds.toString().padStart(2, '0')}`);
        } else {
          setTimeRemaining('Calculating...');
        }
      },
      () => {
        setDownloadComplete(true);
        setIsDownloading(false);
      },
      (error: DownloadError) => {
        setError(error);
        setIsRetrying(error.retryable);
        if (!error.retryable) {
          setIsDownloading(false);
        }
      }
    );

    if (!success && !error?.retryable) {
      setIsDownloading(false);
      setShowDownloadScreen(false);
    }
  };

  const handlePauseResume = () => {
    if (isPaused) {
      apkDownloader.resumeDownload();
      setIsPaused(false);
    } else {
      apkDownloader.pauseDownload();
      setIsPaused(true);
    }
  };

  const handleRetry = () => {
    setError(null);
    setIsRetrying(false);
    handleDownloadAndInstall();
  };

  const handleInstall = async () => {
    setIsInstalling(true);
    const installed = await apkDownloader.installAPK();
    setIsInstalling(false);
    if (installed && !isStrict) {
      navigation.goBack();
    }
  };

  if (!updateInfo) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.content}>
          <Text style={styles.modernTitle}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <>
      <SafeAreaView style={styles.container} edges={['top']}>
        <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
          {/* Material 3 Header */}
          <Animated.View 
            style={[
              styles.modernHeader,
              {
                transform: [
                  { scale: scaleAnim },
                  { 
                    translateY: slideAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-50, 0]
                    })
                  }
                ]
              }
            ]}
          >
            <View style={styles.iconContainer}>
              <LinearGradient
                colors={['#6750A4', '#7C4DFF']}
                style={styles.iconGradient}
              >
                <Ionicons name="download" size={48} color="#fff" />
              </LinearGradient>
            </View>
            
            <Text style={styles.modernTitle}>Update Available</Text>
            <View style={styles.versionBadge}>
              <Text style={styles.modernVersion}>v{updateInfo.latestVersion} ({selectedDownload.architecture})</Text>
            </View>
          </Animated.View>

          {/* Content Section */}
          <Animated.View 
            style={[
              styles.modernContent,
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
            <Text style={styles.sectionTitle}>What's New</Text>
            {fileSize && (
              <View style={styles.fileSizeContainer}>
                <Ionicons name="archive" size={16} color="#6750A4" />
                <Text style={styles.fileSizeText}>Download size: {fileSize}</Text>
              </View>
            )}
            <ScrollView 
              style={styles.modernNotesContainer} 
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 20 }}
            >
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

          {/* Action Buttons */}
          <Animated.View 
            style={[
              styles.modernActions,
              {
                opacity: slideAnim,
                transform: [{
                  translateY: slideAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [40, 0]
                  })
                }]
              }
            ]}
          >
            {!isStrict && !isDownloading && (
              <TouchableOpacity 
                style={styles.modernSecondaryButton} 
                onPress={() => navigation.goBack()}
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
                  <Ionicons name="refresh" size={20} color="#fff" style={styles.loadingSpinner} />
                )}
                <Text style={styles.modernPrimaryButtonText}>
                  {isDownloading ? 'Downloading...' : 'Update Now'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      </SafeAreaView>

      {/* Simplified Download Screen */}
      {showDownloadScreen && (
        <View style={styles.downloadOverlay}>
          <LinearGradient
            colors={['#000', '#1a1a1a']}
            style={StyleSheet.absoluteFillObject}
          />
          
          <View style={styles.downloadContainer}>
            <View style={styles.downloadIconContainer}>
              <LinearGradient
                colors={['#6750A4', '#7C4DFF']}
                style={styles.downloadIconGradient}
              >
                <Ionicons name="cloud-download" size={60} color="#fff" />
              </LinearGradient>
            </View>

            <Text style={styles.downloadTitle}>
              {downloadComplete ? 'Download Complete!' : error ? 'Download Error' : 'Downloading Update'}
            </Text>
            <Text style={styles.downloadSubtitle}>
              {downloadComplete 
                ? 'Ready to install your update' 
                : error 
                  ? error.message
                  : 'Please wait while we prepare your update...'}
            </Text>

            {error && error.retryable && (
              <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
                <LinearGradient colors={['#FF6B35', '#FF8E53']} style={styles.buttonGradient}>
                  <Ionicons name="refresh" size={20} color="#fff" style={styles.loadingSpinner} />
                  <Text style={styles.modernPrimaryButtonText}>Retry Download</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}

            {!downloadComplete && !error ? (
              <>
                <View style={styles.progressContainer}>
                  <View style={styles.progressCircle}>
                    <Text style={styles.progressText}>{Math.round(downloadProgress * 100)}%</Text>
                  </View>
                </View>

                <View style={styles.progressBarContainer}>
                  <View style={styles.progressBarBg}>
                    <View 
                      style={[
                        styles.progressBarFill,
                        { width: `${downloadProgress * 100}%` }
                      ]}
                    >
                      <LinearGradient
                        colors={['#6750A4', '#7C4DFF']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={StyleSheet.absoluteFillObject}
                      />
                    </View>
                  </View>
                </View>

                <View style={styles.downloadStats}>
                  <View style={styles.statItem}>
                    <View style={styles.statIconBg}>
                      <Ionicons name="archive" size={16} color="#6750A4" />
                    </View>
                    <Text style={styles.statText}>{downloadSize}</Text>
                  </View>
                  <View style={styles.statItem}>
                    <View style={styles.statIconBg}>
                      <Ionicons name="flash" size={16} color="#6750A4" />
                    </View>
                    <Text style={styles.statText}>{downloadSpeed}</Text>
                  </View>
                  <View style={styles.statItem}>
                    <View style={styles.statIconBg}>
                      <Ionicons name="time" size={16} color="#6750A4" />
                    </View>
                    <Text style={styles.statText}>{timeRemaining}</Text>
                  </View>
                </View>

                <TouchableOpacity 
                  style={styles.pauseButton} 
                  onPress={handlePauseResume}
                  activeOpacity={0.8}
                >
                  <Text style={styles.pauseButtonText}>
                    {isPaused ? 'Resume' : 'Pause'}
                  </Text>
                </TouchableOpacity>
              </>
            ) : downloadComplete ? (
              <View style={styles.installSection}>
                <View style={styles.successIcon}>
                  <Ionicons name="checkmark-circle" size={80} color="#00C851" />
                </View>
                
                <View style={styles.installActions}>
                  <TouchableOpacity
                    style={styles.installButton}
                    onPress={handleInstall}
                    disabled={isInstalling}
                    activeOpacity={0.9}
                  >
                    <LinearGradient
                      colors={isInstalling ? ['#666', '#555'] : ['#00C851', '#00A041']}
                      style={styles.buttonGradient}
                    >
                      {isInstalling && (
                        <Ionicons name="refresh" size={20} color="#fff" style={styles.loadingSpinner} />
                      )}
                      <Text style={styles.modernPrimaryButtonText}>
                        {isInstalling ? 'Installing...' : 'Install Now'}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                  
                  {!isStrict && (
                    <TouchableOpacity
                      style={styles.laterButton}
                      onPress={() => setShowDownloadScreen(false)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.laterButtonText}>Install Later</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ) : null}
          </View>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  content: { flex: 1 },
  
  // Material 3 Header
  modernHeader: {
    alignItems: 'center',
    paddingTop: 40,
    paddingBottom: 30,
    paddingHorizontal: 24
  },
  iconContainer: {
    marginBottom: 24,
    shadowColor: '#6750A4',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12
  },
  iconGradient: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center'
  },
  modernTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: -0.5
  },
  versionBadge: {
    backgroundColor: 'rgba(103, 80, 164, 0.15)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(103, 80, 164, 0.3)'
  },
  modernVersion: {
    fontSize: 16,
    color: '#6750A4',
    fontWeight: '600'
  },
  
  // Content Section
  modernContent: {
    flex: 1,
    paddingHorizontal: 24
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 20,
    letterSpacing: -0.3
  },
  modernNotesContainer: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)'
  },
  modernNoteItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingLeft: 4
  },
  noteBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#6750A4',
    marginTop: 8,
    marginRight: 16
  },
  modernNoteText: {
    fontSize: 16,
    color: '#E6E1E5',
    flex: 1,
    lineHeight: 24,
    fontWeight: '400'
  },
  
  // Actions
  modernActions: {
    flexDirection: 'row',
    padding: 24,
    gap: 12
  },
  modernSecondaryButton: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center'
  },
  modernSecondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E6E1E5'
  },
  modernPrimaryButton: {
    flex: 2,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#6750A4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8
  },
  buttonGradient: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8
  },
  modernPrimaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff'
  },
  modernDisabledButton: {
    opacity: 0.6
  },
  loadingSpinner: {
    marginRight: 8
  },
  
  // Download Screen
  downloadOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000
  },
  downloadContainer: {
    alignItems: 'center',
    paddingHorizontal: 40,
    zIndex: 10
  },
  downloadIconContainer: {
    marginBottom: 32
  },
  downloadIconGradient: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6750A4',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12
  },
  downloadTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: -0.5
  },
  downloadSubtitle: {
    fontSize: 16,
    color: '#E6E1E5',
    marginBottom: 40,
    textAlign: 'center',
    opacity: 0.8
  },
  progressContainer: {
    marginBottom: 32
  },
  progressCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 2,
    borderColor: 'rgba(103, 80, 164, 0.3)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  progressText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#6750A4'
  },
  progressBarContainer: {
    width: 280,
    marginBottom: 32
  },
  progressBarBg: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 4,
    overflow: 'hidden'
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4
  },
  downloadStats: {
    flexDirection: 'row',
    gap: 24
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  statIconBg: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(103, 80, 164, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(103, 80, 164, 0.3)'
  },
  statText: {
    fontSize: 14,
    color: '#E6E1E5',
    fontWeight: '500'
  },
  
  // Install Section
  installSection: {
    alignItems: 'center',
    marginTop: 20
  },
  successIcon: {
    marginBottom: 32
  },
  installActions: {
    alignItems: 'center',
    gap: 16
  },
  installButton: {
    width: 200,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#00C851',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8
  },
  laterButton: {
    paddingVertical: 12,
    paddingHorizontal: 24
  },
  laterButtonText: {
    fontSize: 16,
    color: '#E6E1E5',
    fontWeight: '500',
    opacity: 0.8
  },
  
  // File Size Display
  fileSizeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
    gap: 8
  },
  fileSizeText: {
    fontSize: 14,
    color: '#6750A4',
    fontWeight: '500'
  },
  
  // Error & Retry
  retryButton: {
    width: 200,
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 20,
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8
  },
  
  // Pause/Resume
  pauseButton: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)'
  },
  pauseButtonText: {
    fontSize: 14,
    color: '#E6E1E5',
    fontWeight: '600',
    textAlign: 'center'
  }
});
