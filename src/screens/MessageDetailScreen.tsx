import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Linking, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import MessagesAPI, { Message } from '../api/messages';

export default function MessageDetailScreen({ navigation, route }: any) {
  const { message }: { message: Message } = route.params;
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadContent();
  }, []);

  const loadContent = async () => {
    try {
      const markdown = await MessagesAPI.getMessageContent(message.url);
      setContent(markdown);
    } catch (error) {
      setContent('Failed to load message content.');
    } finally {
      setLoading(false);
    }
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

  // Enhanced markdown renderer
  const renderContent = (text: string) => {
    const lines = text.split('\n');
    const elements = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      // Skip empty lines
      if (!line.trim()) {
        elements.push(<View key={i} style={styles.spacing} />);
        i++;
        continue;
      }

      // Images
      if (line.match(/!\[.*?\]\(.*?\)/)) {
        const match = line.match(/!\[.*?\]\((.*?)\)/);
        if (match) {
          elements.push(<Image key={i} source={{ uri: match[1] }} style={styles.image} />);
        }
        i++;
        continue;
      }

      // Tables
      if (line.includes('|')) {
        const tableRows = [];
        let j = i;
        while (j < lines.length && lines[j].includes('|')) {
          if (!lines[j].match(/^\s*\|?\s*[-:]+\s*\|/)) {
            tableRows.push(lines[j]);
          }
          j++;
        }
        if (tableRows.length > 0) {
          elements.push(
            <View key={i} style={styles.table}>
              {tableRows.map((row, idx) => (
                <View key={idx} style={styles.tableRow}>
                  {row.split('|').filter(cell => cell.trim()).map((cell, cellIdx) => (
                    <Text key={cellIdx} style={[styles.tableCell, idx === 0 && styles.tableHeader]}>
                      {cell.trim()}
                    </Text>
                  ))}
                </View>
              ))}
            </View>
          );
          i = j;
          continue;
        }
      }

      // Headers
      if (line.startsWith('# ')) {
        elements.push(<Text key={i} style={styles.h1}>{line.substring(2)}</Text>);
        i++;
        continue;
      }
      if (line.startsWith('## ')) {
        elements.push(<Text key={i} style={styles.h2}>{line.substring(3)}</Text>);
        i++;
        continue;
      }
      if (line.startsWith('### ')) {
        elements.push(<Text key={i} style={styles.h3}>{line.substring(4)}</Text>);
        i++;
        continue;
      }
      
      // Lists
      if (line.startsWith('- ')) {
        elements.push(<Text key={i} style={styles.listItem}>• {renderInlineFormatting(line.substring(2))}</Text>);
        i++;
        continue;
      }
      if (/^\d+\. /.test(line)) {
        const match = line.match(/^(\d+)\. (.*)/);
        elements.push(<Text key={i} style={styles.listItem}>{match?.[1]}. {renderInlineFormatting(match?.[2] || '')}</Text>);
        i++;
        continue;
      }
      
      // Horizontal rule
      if (line.trim() === '---') {
        elements.push(<View key={i} style={styles.divider} />);
        i++;
        continue;
      }
      
      // Code block
      if (line.startsWith('```')) {
        const codeLines = [];
        i++;
        while (i < lines.length && !lines[i].startsWith('```')) {
          codeLines.push(lines[i]);
          i++;
        }
        elements.push(
          <View key={i} style={styles.codeBlock}>
            <Text style={styles.codeText}>{codeLines.join('\n')}</Text>
          </View>
        );
        i++;
        continue;
      }
      
      // Blockquote
      if (line.startsWith('> ')) {
        elements.push(
          <View key={i} style={styles.blockquote}>
            <Text style={styles.blockquoteText}>{renderInlineFormatting(line.substring(2))}</Text>
          </View>
        );
        i++;
        continue;
      }
      
      // Regular paragraph with inline formatting
      elements.push(
        <Text key={i} style={styles.paragraph}>
          {renderInlineFormatting(line)}
        </Text>
      );
      i++;
    }

    return elements;
  };

  // Inline formatting (links, bold, italic, code)
  const renderInlineFormatting = (text: string) => {
    const parts = [];
    let currentIndex = 0;
    let key = 0;

    const regex = /(\[.*?\]\(.*?\)|\*\*.*?\*\*|\*.*?\*|`.*?`)/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > currentIndex) {
        parts.push(text.substring(currentIndex, match.index));
      }

      const matchedText = match[0];
      if (matchedText.match(/\[.*?\]\(.*?\)/)) {
        const linkMatch = matchedText.match(/\[(.*?)\]\((.*?)\)/);
        if (linkMatch) {
          parts.push(
            <TouchableOpacity key={key++} onPress={() => Linking.openURL(linkMatch[2])}>
              <Text style={styles.link}>{linkMatch[1]}</Text>
            </TouchableOpacity>
          );
        }
      } else if (matchedText.startsWith('**') && matchedText.endsWith('**')) {
        parts.push(<Text key={key++} style={styles.bold}>{matchedText.slice(2, -2)}</Text>);
      } else if (matchedText.startsWith('*') && matchedText.endsWith('*')) {
        parts.push(<Text key={key++} style={styles.italic}>{matchedText.slice(1, -1)}</Text>);
      } else if (matchedText.startsWith('`') && matchedText.endsWith('`')) {
        parts.push(<Text key={key++} style={styles.inlineCode}>{matchedText.slice(1, -1)}</Text>);
      }

      currentIndex = match.index + matchedText.length;
    }

    if (currentIndex < text.length) {
      parts.push(text.substring(currentIndex));
    }

    return parts.length > 0 ? parts : [text];
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
            {renderContent(content)}
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
  h1: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginBottom: 16, marginTop: 8 },
  h2: { fontSize: 20, fontWeight: '600', color: '#fff', marginBottom: 12, marginTop: 16 },
  h3: { fontSize: 18, fontWeight: '600', color: '#fff', marginBottom: 10, marginTop: 12 },
  paragraph: { fontSize: 16, color: '#ccc', lineHeight: 24, marginBottom: 8 },
  listItem: { fontSize: 16, color: '#ccc', lineHeight: 24, marginBottom: 4, marginLeft: 16 },
  bold: { fontWeight: 'bold', color: '#fff' },
  italic: { fontStyle: 'italic', color: '#aaa' },
  inlineCode: { fontFamily: 'monospace', backgroundColor: '#1a1a1a', color: '#1db954', paddingHorizontal: 4, paddingVertical: 2, borderRadius: 3 },
  codeBlock: { backgroundColor: '#1a1a1a', padding: 12, borderRadius: 6, marginVertical: 8, borderLeftWidth: 3, borderLeftColor: '#1db954' },
  codeText: { fontFamily: 'monospace', color: '#ccc', fontSize: 14 },
  blockquote: { backgroundColor: '#1a1a1a', padding: 12, borderRadius: 6, marginVertical: 8, borderLeftWidth: 4, borderLeftColor: '#666' },
  blockquoteText: { color: '#aaa', fontStyle: 'italic', fontSize: 16, lineHeight: 22 },
  divider: { height: 1, backgroundColor: '#333', marginVertical: 16 },
  spacing: { height: 8 },
  link: { color: '#1db954', textDecorationLine: 'underline' },
  table: { marginVertical: 8, borderWidth: 1, borderColor: '#333', borderRadius: 4 },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#333' },
  tableCell: { flex: 1, padding: 8, color: '#ccc', fontSize: 14 },
  tableHeader: { fontWeight: 'bold', backgroundColor: '#1a1a1a' },
  image: { width: '100%', height: 200, resizeMode: 'contain', marginVertical: 8, borderRadius: 4 },
});