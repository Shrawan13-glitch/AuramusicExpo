import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import RenderHtml from 'react-native-render-html';
import MessagesAPI, { Message } from '../api/messages';

export default function MessageDetailScreen({ navigation, route }: any) {
  const { message }: { message: Message } = route.params;
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const { width } = useWindowDimensions();

  useEffect(() => {
    loadContent();
  }, []);

  const loadContent = async () => {
    try {
      const markdown = await MessagesAPI.getMessageContent(message.url);
      // Convert markdown to HTML for rendering
      const html = markdownToHtml(markdown);
      setContent(html);
    } catch (error) {
      setContent('<p>Failed to load message content.</p>');
    } finally {
      setLoading(false);
    }
  };

  const markdownToHtml = (md: string) => {
    return md
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/gim, '<em>$1</em>')
      .replace(/^- (.*$)/gim, '<li>$1</li>')
      .replace(/---/gim, '<hr>')
      .replace(/\n\n/gim, '</p><p>')
      .replace(/^(?!<[h|l|p])(.*)$/gim, '<p>$1</p>')
      .replace(/<li>/gim, '<ul><li>')
      .replace(/<\/li>/gim, '</li></ul>');
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'announcement': return '#1db954';
      case 'update': return '#3b82f6';
      case 'maintenance': return '#f59e0b';
      case 'alert': return '#ef4444';
      default: return '#666';
    }
  };

  const htmlStyles = {
    body: { color: '#ccc', fontSize: 16, lineHeight: 24 },
    h1: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginBottom: 16 },
    h2: { color: '#fff', fontSize: 20, fontWeight: '600', marginBottom: 12 },
    p: { color: '#ccc', fontSize: 16, lineHeight: 24, marginBottom: 8 },
    strong: { color: '#fff', fontWeight: 'bold' },
    em: { color: '#aaa', fontStyle: 'italic' },
    li: { color: '#ccc', fontSize: 16, lineHeight: 24, marginBottom: 4 },
    hr: { backgroundColor: '#333', height: 1, marginVertical: 16 },
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>{message.title}</Text>
          <Text style={[styles.headerType, { color: getTypeColor(message.type) }]}>
            {message.type.toUpperCase()}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.content}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#1db954" />
          </View>
        ) : (
          <View style={styles.messageContent}>
            <RenderHtml
              contentWidth={width - 40}
              source={{ html: content }}
              tagsStyles={htmlStyles}
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#282828' },
  backButton: { marginRight: 16 },
  headerInfo: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#fff', marginBottom: 4 },
  headerType: { fontSize: 12, fontWeight: '600' },
  content: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100 },
  messageContent: { padding: 20 },
});