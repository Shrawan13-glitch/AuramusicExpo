import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../store/ThemeContext';

export default function ThemeSettingsScreen({ navigation }: any) {
  const { theme, updateTheme, resetTheme } = useTheme();
  const [loading, setLoading] = useState(false);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant photo library access to set background image');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [9, 16],
      quality: 0.8,
    });

    if (!result.canceled) {
      setLoading(true);
      await updateTheme({ backgroundImage: result.assets[0].uri });
      setLoading(false);
    }
  };

  const removeBackground = () => {
    Alert.alert(
      'Remove Background',
      'Are you sure you want to remove the background image?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => updateTheme({ backgroundImage: null }) }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Theme Settings</Text>
        <TouchableOpacity onPress={resetTheme} style={styles.resetButton}>
          <Ionicons name="refresh" size={20} color="#1db954" />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={styles.section}>
          <View style={styles.toggleContainer}>
            <Text style={styles.sectionTitle}>Enable Background</Text>
            <TouchableOpacity 
              style={[styles.toggle, theme.enableBackground && styles.toggleActive]} 
              onPress={() => updateTheme({ enableBackground: !theme.enableBackground })}
            >
              <View style={[styles.toggleThumb, theme.enableBackground && styles.toggleThumbActive]} />
            </TouchableOpacity>
          </View>
        </View>

        {theme.enableBackground && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Background Image</Text>
          
          {theme.backgroundImage ? (
            <View style={styles.imagePreview}>
              <Image source={{ uri: theme.backgroundImage }} style={styles.previewImage} />
              <View style={styles.imageActions}>
                <TouchableOpacity style={styles.actionButton} onPress={pickImage}>
                  <Ionicons name="image" size={20} color="#1db954" />
                  <Text style={styles.actionText}>Change</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionButton, styles.removeButton]} onPress={removeBackground}>
                  <Ionicons name="trash" size={20} color="#ff4757" />
                  <Text style={[styles.actionText, styles.removeText]}>Remove</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity style={styles.addImageButton} onPress={pickImage} disabled={loading}>
              <Ionicons name="image" size={32} color="#666" />
              <Text style={styles.addImageText}>Tap to add background image</Text>
            </TouchableOpacity>
          )}
          </View>
        )}

        {theme.backgroundImage && theme.enableBackground && (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Blur Intensity</Text>
              <View style={styles.sliderContainer}>
                <Slider
                  style={styles.slider}
                  minimumValue={0}
                  maximumValue={20}
                  value={theme.blurIntensity}
                  onValueChange={(value) => updateTheme({ blurIntensity: value })}
                  minimumTrackTintColor="#1db954"
                  maximumTrackTintColor="#333"
                  thumbStyle={styles.sliderThumb}
                />
                <Text style={styles.sliderValue}>{Math.round(theme.blurIntensity)}</Text>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Overlay Opacity</Text>
              <View style={styles.sliderContainer}>
                <Slider
                  style={styles.slider}
                  minimumValue={0}
                  maximumValue={1}
                  value={theme.overlayOpacity}
                  onValueChange={(value) => updateTheme({ overlayOpacity: value })}
                  minimumTrackTintColor="#1db954"
                  maximumTrackTintColor="#333"
                  thumbStyle={styles.sliderThumb}
                />
                <Text style={styles.sliderValue}>{Math.round(theme.overlayOpacity * 100)}%</Text>
              </View>
            </View>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 },
  backButton: { width: 32 },
  resetButton: { width: 32, alignItems: 'flex-end' },
  headerTitle: { fontSize: 20, fontWeight: '600', color: '#fff' },
  content: { flex: 1, paddingHorizontal: 20 },
  section: { marginBottom: 32 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#fff', marginBottom: 16 },
  imagePreview: { backgroundColor: '#121212', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#282828' },
  previewImage: { width: '100%', height: 200, borderRadius: 12, marginBottom: 16 },
  imageActions: { flexDirection: 'row', gap: 12 },
  actionButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 8, backgroundColor: '#1db954' + '20', borderWidth: 1, borderColor: '#1db954' },
  removeButton: { backgroundColor: '#ff4757' + '20', borderColor: '#ff4757' },
  actionText: { fontSize: 14, fontWeight: '600', color: '#1db954', marginLeft: 8 },
  removeText: { color: '#ff4757' },
  addImageButton: { alignItems: 'center', justifyContent: 'center', padding: 40, backgroundColor: '#121212', borderRadius: 16, borderWidth: 2, borderColor: '#333', borderStyle: 'dashed' },
  addImageText: { fontSize: 16, color: '#666', marginTop: 12 },
  sliderContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#121212', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#282828' },
  slider: { flex: 1, height: 40 },
  sliderThumb: { backgroundColor: '#1db954', width: 20, height: 20 },
  sliderValue: { fontSize: 16, fontWeight: '600', color: '#fff', marginLeft: 16, minWidth: 40, textAlign: 'center' },
  toggleContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggle: { width: 50, height: 30, borderRadius: 15, backgroundColor: '#333', padding: 2 },
  toggleActive: { backgroundColor: '#1db954' },
  toggleThumb: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#fff' },
  toggleThumbActive: { transform: [{ translateX: 20 }] },
});