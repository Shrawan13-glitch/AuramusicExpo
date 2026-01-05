import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { launchImageLibrary, launchCamera, MediaType } from 'react-native-image-crop-picker';
import DocumentPickerRN from 'expo-document-picker';
import { Platform, Alert } from 'react-native';

export interface FilePickerResult {
  uri: string;
  name: string;
  size?: number;
  type?: string;
  mimeType?: string;
}

export interface FilePickerOptions {
  allowMultiple?: boolean;
  mediaType?: 'photo' | 'video' | 'mixed' | 'audio' | 'document';
  quality?: number;
  allowsEditing?: boolean;
  aspect?: [number, number];
  maxWidth?: number;
  maxHeight?: number;
}

class FilePickerService {
  // Request permissions
  private async requestPermissions(): Promise<boolean> {
    try {
      const { status: mediaLibraryStatus } = await MediaLibrary.requestPermissionsAsync();
      const { status: imagePickerStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
      
      return mediaLibraryStatus === 'granted' && 
             imagePickerStatus === 'granted' && 
             cameraStatus === 'granted';
    } catch (error) {
      console.log('Permission request failed:', error);
      return false;
    }
  }

  // Pick images with advanced options
  async pickImages(options: FilePickerOptions = {}): Promise<FilePickerResult[]> {
    try {
      await this.requestPermissions();

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: options.mediaType === 'video' ? ImagePicker.MediaTypeOptions.Videos : 
                   options.mediaType === 'mixed' ? ImagePicker.MediaTypeOptions.All :
                   ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: options.allowMultiple || false,
        allowsEditing: options.allowsEditing || false,
        quality: options.quality || 0.8,
        aspect: options.aspect,
        exif: false,
      });

      if (!result.canceled) {
        return result.assets.map(asset => ({
          uri: asset.uri,
          name: asset.fileName || `image_${Date.now()}.jpg`,
          size: asset.fileSize,
          type: asset.type,
          mimeType: asset.mimeType,
        }));
      }
      return [];
    } catch (error) {
      console.log('Image picker error:', error);
      return [];
    }
  }

  // Pick images with crop functionality
  async pickImagesWithCrop(options: FilePickerOptions = {}): Promise<FilePickerResult[]> {
    try {
      const images = await launchImageLibrary({
        mediaType: 'photo' as MediaType,
        multiple: options.allowMultiple || false,
        cropping: true,
        cropperCircleOverlay: false,
        compressImageMaxWidth: options.maxWidth || 1000,
        compressImageMaxHeight: options.maxHeight || 1000,
        compressImageQuality: options.quality || 0.8,
      });

      if (Array.isArray(images)) {
        return images.map(image => ({
          uri: image.path,
          name: image.filename || `cropped_${Date.now()}.jpg`,
          size: image.size,
          type: 'image',
          mimeType: image.mime,
        }));
      } else {
        return [{
          uri: images.path,
          name: images.filename || `cropped_${Date.now()}.jpg`,
          size: images.size,
          type: 'image',
          mimeType: images.mime,
        }];
      }
    } catch (error) {
      if (error.code !== 'E_PICKER_CANCELLED') {
        console.log('Image crop picker error:', error);
      }
      return [];
    }
  }

  // Take photo with camera
  async takePhoto(options: FilePickerOptions = {}): Promise<FilePickerResult | null> {
    try {
      await this.requestPermissions();

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: options.allowsEditing || false,
        quality: options.quality || 0.8,
        aspect: options.aspect,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        return {
          uri: asset.uri,
          name: asset.fileName || `photo_${Date.now()}.jpg`,
          size: asset.fileSize,
          type: asset.type,
          mimeType: asset.mimeType,
        };
      }
      return null;
    } catch (error) {
      console.log('Camera error:', error);
      return null;
    }
  }

  // Pick documents
  async pickDocuments(options: FilePickerOptions = {}): Promise<FilePickerResult[]> {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        multiple: options.allowMultiple || false,
        copyToCacheDirectory: true,
      });

      if (!result.canceled) {
        if (Array.isArray(result.assets)) {
          return result.assets.map(asset => ({
            uri: asset.uri,
            name: asset.name,
            size: asset.size,
            type: 'document',
            mimeType: asset.mimeType,
          }));
        } else {
          return [{
            uri: result.assets.uri,
            name: result.assets.name,
            size: result.assets.size,
            type: 'document',
            mimeType: result.assets.mimeType,
          }];
        }
      }
      return [];
    } catch (error) {
      console.log('Document picker error:', error);
      return [];
    }
  }

  // Pick audio files
  async pickAudioFiles(options: FilePickerOptions = {}): Promise<FilePickerResult[]> {
    try {
      const result = await DocumentPickerRN.getDocumentAsync({
        type: 'audio/*',
        multiple: options.allowMultiple || false,
        copyToCacheDirectory: true,
      });

      if (!result.canceled) {
        if (Array.isArray(result.assets)) {
          return result.assets.map(asset => ({
            uri: asset.uri,
            name: asset.name,
            size: asset.size,
            type: 'audio',
            mimeType: asset.mimeType,
          }));
        } else {
          return [{
            uri: result.assets.uri,
            name: result.assets.name,
            size: result.assets.size,
            type: 'audio',
            mimeType: result.assets.mimeType,
          }];
        }
      }
      return [];
    } catch (error) {
      if (!result.canceled) {
        console.log('Audio picker error:', error);
      }
      return [];
    }
  }

  // Show picker options
  async showPickerOptions(options: FilePickerOptions = {}): Promise<FilePickerResult[]> {
    return new Promise((resolve) => {
      Alert.alert(
        'Select Option',
        'Choose how you want to select files',
        [
          { text: 'Camera', onPress: async () => {
            const result = await this.takePhoto(options);
            resolve(result ? [result] : []);
          }},
          { text: 'Gallery', onPress: async () => {
            const result = await this.pickImages(options);
            resolve(result);
          }},
          { text: 'Documents', onPress: async () => {
            const result = await this.pickDocuments(options);
            resolve(result);
          }},
          { text: 'Cancel', style: 'cancel', onPress: () => resolve([]) }
        ]
      );
    });
  }
}

export const filePicker = new FilePickerService();

// Convenience functions
export const pickImage = (options?: FilePickerOptions) => filePicker.pickImages({ ...options, allowMultiple: false });
export const pickImages = (options?: FilePickerOptions) => filePicker.pickImages({ ...options, allowMultiple: true });
export const pickImageWithCrop = (options?: FilePickerOptions) => filePicker.pickImagesWithCrop({ ...options, allowMultiple: false });
export const takePhoto = (options?: FilePickerOptions) => filePicker.takePhoto(options);
export const pickDocument = (options?: FilePickerOptions) => filePicker.pickDocuments({ ...options, allowMultiple: false });
export const pickDocuments = (options?: FilePickerOptions) => filePicker.pickDocuments({ ...options, allowMultiple: true });
export const pickAudio = (options?: FilePickerOptions) => filePicker.pickAudioFiles({ ...options, allowMultiple: false });
export const showFilePicker = (options?: FilePickerOptions) => filePicker.showPickerOptions(options);