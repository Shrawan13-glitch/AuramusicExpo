import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import TabHeader from '../components/TabHeader';
import MessagesAPI, { Message } from '../api/messages';

export default function MessagesScreen({ navigation }: any) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [readMessages, setReadMessages] = useState<string[]>([]);

  useEffect(() => {
    loadMessages();
    loadReadMessages();
  }, []);

  const loadMessages = async () => {
    try {
      const data = await MessagesAPI.getMessages();
      setMessages(data);
    } catch (error) {
      // Handle error silently
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadReadMessages = async () => {
    const read = await MessagesAPI.getReadMessages();
    setReadMessages(read);
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadMessages();
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'announcement': return 'megaphone';
      case 'update': return 'refresh-circle';
      case 'maintenance': return 'construct';
      case 'alert': return 'warning';
      default: return 'mail';
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

  const handleMessagePress = async (message: Message) => {
    await MessagesAPI.markAsRead(message.id);
    setReadMessages(prev => [...prev, message.id]);
    navigation.navigate('MessageDetail', { message });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <TabHeader title="Messages" navigation={navigation} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1db954" />
        </View>
      </SafeAreaView>
    );
  }

  if (messages.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <TabHeader title="Messages" navigation={navigation} />
        <ScrollView 
          style={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
        >
          <View style={styles.placeholder}>
            <Ionicons name="mail-outline" size={64} color="#666" />
            <Text style={styles.placeholderTitle}>No Messages</Text>
            <Text style={styles.placeholderText}>
              Check back later for updates and announcements from the developer.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <TabHeader title="Messages" navigation={navigation} />
      <ScrollView 
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
      >
        {messages.map((message) => {
          const isRead = readMessages.includes(message.id);
          const typeColor = getTypeColor(message.type);
          
          return (
            <TouchableOpacity 
              key={message.id} 
              style={[styles.messageCard, !isRead && styles.unreadCard]} 
              onPress={() => handleMessagePress(message)}
            >
              <View style={styles.messageHeader}>
                <View style={[styles.typeIcon, { backgroundColor: typeColor + '20' }]}>
                  <Ionicons name={getTypeIcon(message.type)} size={20} color={typeColor} />
                </View>
                <View style={styles.messageInfo}>
                  <Text style={[styles.messageTitle, !isRead && styles.unreadTitle]}>
                    {message.title}
                  </Text>
                  <Text style={styles.messageDate}>{message.date}</Text>
                </View>
                {!isRead && <View style={styles.unreadDot} />}
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  content: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  placeholderTitle: { fontSize: 20, fontWeight: '600', color: '#fff', marginTop: 16, marginBottom: 8 },
  placeholderText: { fontSize: 16, color: '#666', textAlign: 'center', lineHeight: 24 },
  messageCard: { backgroundColor: '#121212', marginHorizontal: 16, marginVertical: 6, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#282828' },
  unreadCard: { borderColor: '#1db954', backgroundColor: '#1db954' + '10' },
  messageHeader: { flexDirection: 'row', alignItems: 'center' },
  typeIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  messageInfo: { flex: 1 },
  messageTitle: { fontSize: 16, fontWeight: '600', color: '#fff', marginBottom: 4 },
  unreadTitle: { color: '#1db954' },
  messageDate: { fontSize: 14, color: '#666' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#1db954' },
});