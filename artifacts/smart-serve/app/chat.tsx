import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/AppContext';

type Message = { id: string; text: string; mine: boolean };

export default function ChatScreen() {
  const colors = useColors();
  const { activeBooking } = useApp();
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', text: 'Hi, I’m on my way. I’ll inspect the sink before sharing the final quote.', mine: false },
    { id: '2', text: 'Thank you. Please call when you arrive at the gate.', mine: true },
  ]);
  const send = () => {
    const text = message.trim();
    if (!text) return;
    setMessages((current) => [...current, { id: Date.now().toString(), text, mine: true }]);
    setMessage('');
  };
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()}><Feather name="arrow-left" size={22} color={colors.foreground} /></Pressable>
        <View style={[styles.avatar, { backgroundColor: colors.primary }]}><Text style={[styles.avatarText, { color: colors.primaryForeground }]}>RK</Text></View>
        <View style={{ flex: 1 }}><Text style={[styles.name, { color: colors.foreground }]}>{activeBooking?.providerName ?? 'Smart Serve provider'}</Text><Text style={[styles.status, { color: colors.primary }]}>Active service · reply usually within 2 min</Text></View>
        <Feather name="phone" size={19} color={colors.primary} />
      </View>
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messages}
        renderItem={({ item }) => <View style={[styles.bubble, { backgroundColor: item.mine ? colors.primary : colors.card, borderColor: colors.border, alignSelf: item.mine ? 'flex-end' : 'flex-start' }]}><Text style={[styles.bubbleText, { color: item.mine ? colors.primaryForeground : colors.foreground }]}>{item.text}</Text></View>}
      />
      <View style={[styles.composer, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
        <View style={[styles.inputWrap, { backgroundColor: colors.card, borderColor: colors.border }]}><Feather name="paperclip" size={17} color={colors.mutedForeground} /><TextInput value={message} onChangeText={setMessage} placeholder="Message provider" placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground }]} /></View>
        <Pressable onPress={send} style={[styles.send, { backgroundColor: colors.primary }]}><Feather name="arrow-up" size={19} color={colors.primaryForeground} /></Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 55, paddingHorizontal: 18, paddingBottom: 13, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: 'Inter_700Bold', fontSize: 13 },
  name: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  status: { fontFamily: 'Inter_400Regular', fontSize: 10, marginTop: 3 },
  messages: { flexGrow: 1, padding: 18, gap: 10, justifyContent: 'flex-end' },
  bubble: { maxWidth: '82%', borderRadius: 17, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 10 },
  bubbleText: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19 },
  composer: { padding: 12, paddingBottom: 28, borderTopWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  inputWrap: { flex: 1, minHeight: 46, borderRadius: 15, borderWidth: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 8 },
  input: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 13 },
  send: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
});