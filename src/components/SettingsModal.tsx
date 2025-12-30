import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

interface Option {
  key: string;
  label: string;
  subtitle?: string;
}

interface SettingsModalProps {
  visible: boolean;
  title: string;
  options: Option[];
  selectedKey: string;
  onSelect: (key: string) => void;
  onClose: () => void;
}

export default function SettingsModal({ visible, title, options, selectedKey, onSelect, onClose }: SettingsModalProps) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.cancelButton}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{title}</Text>
          <View style={styles.placeholder} />
        </View>
        
        <ScrollView style={styles.content}>
          {options.map((option) => (
            <TouchableOpacity
              key={option.key}
              style={styles.option}
              onPress={() => {
                onSelect(option.key);
                onClose();
              }}
            >
              <View style={styles.optionContent}>
                <Text style={styles.optionLabel}>{option.label}</Text>
                {option.subtitle && <Text style={styles.optionSubtitle}>{option.subtitle}</Text>}
              </View>
              {selectedKey === option.key && (
                <Ionicons name="checkmark" size={20} color="#1db954" />
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 20, 
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a'
  },
  cancelButton: { fontSize: 16, color: '#1db954' },
  title: { fontSize: 18, fontWeight: '600', color: '#fff' },
  placeholder: { width: 60 },
  content: { flex: 1 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a'
  },
  optionContent: { flex: 1 },
  optionLabel: { fontSize: 16, color: '#fff', fontWeight: '500' },
  optionSubtitle: { fontSize: 14, color: '#666', marginTop: 2 },
});