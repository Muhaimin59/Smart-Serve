import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { PrimaryButton, Screen, Tag } from '@/components/SmartServeUI';

export default function VoiceScreen() {
  const colors = useColors();
  const [listening, setListening] = useState(false);
  const [understood, setUnderstood] = useState(false);
  const toggleListening = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setListening(true);
    setTimeout(() => { setListening(false); setUnderstood(true); }, 900);
  };
  return (
    <Screen>
      <View style={styles.topRow}><Pressable onPress={() => router.back()}><Feather name="arrow-left" size={22} color={colors.foreground} /></Pressable><Text style={[styles.topTitle, { color: colors.foreground }]}>Book with voice</Text><View style={{ width: 22 }} /></View>
      <View style={[styles.hero, { backgroundColor: colors.accent }]}>
        <View style={[styles.micCircle, { backgroundColor: colors.primary }]}><Feather name="mic" size={30} color={colors.primaryForeground} /></View>
        <Text style={[styles.heroTitle, { color: colors.accentForeground }]}>{listening ? 'Listening…' : understood ? 'I heard you' : 'Tell us what you need'}</Text>
        <Text style={[styles.heroCopy, { color: '#6d5b29' }]}>{listening ? 'Speak naturally. You can mention the place, time, and urgency.' : 'No forms. Just describe the problem in your own words.'}</Text>
        <Pressable onPress={toggleListening} style={({ pressed }) => [styles.listenButton, { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 }]}><Feather name={listening ? 'square' : 'mic'} size={17} color={colors.primaryForeground} /><Text style={[styles.listenText, { color: colors.primaryForeground }]}>{listening ? 'Stop listening' : 'Start speaking'}</Text></Pressable>
      </View>
      {understood ? (
        <View style={[styles.understoodCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.understoodHeader}><Text style={[styles.eyebrow, { color: colors.primary }]}>DID I UNDERSTAND CORRECTLY?</Text><Tag tone="green">GOOD MATCH</Tag></View>
          <Text style={[styles.requestQuote, { color: colors.foreground }]}>“I need a plumber tomorrow morning because water is leaking from my kitchen sink.”</Text>
          <View style={styles.parsedList}><Parsed label="Service" value="Plumbing" /><Parsed label="Problem" value="Kitchen sink leakage" /><Parsed label="When" value="Tomorrow morning" /><Parsed label="Priority" value="Normal" /></View>
          <PrimaryButton onPress={() => router.push({ pathname: '/providers', params: { query: 'Plumbing' } })} icon="check">Yes, find providers</PrimaryButton>
          <PrimaryButton secondary onPress={() => setUnderstood(false)} icon="edit-2">Edit request</PrimaryButton>
        </View>
      ) : (
        <View style={styles.example}><Feather name="volume-2" size={17} color={colors.primary} /><Text style={[styles.exampleText, { color: colors.mutedForeground }]}>Try: “I need someone to fix my leaking bathroom pipe.”</Text></View>
      )}
    </Screen>
  );
}

function Parsed({ label, value }: { label: string; value: string }) {
  const colors = useColors();
  return <View style={styles.parsed}><Text style={[styles.parsedLabel, { color: colors.mutedForeground }]}>{label}</Text><Text style={[styles.parsedValue, { color: colors.foreground }]}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topTitle: { fontFamily: 'Inter_700Bold', fontSize: 17 },
  hero: { borderRadius: 23, padding: 20, alignItems: 'center', gap: 10 },
  micCircle: { width: 74, height: 74, borderRadius: 37, alignItems: 'center', justifyContent: 'center', marginBottom: 7 },
  heroTitle: { fontFamily: 'Inter_700Bold', fontSize: 23, textAlign: 'center' },
  heroCopy: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18, textAlign: 'center', maxWidth: 280 },
  listenButton: { minHeight: 48, paddingHorizontal: 17, borderRadius: 15, flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 7 },
  listenText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  example: { flexDirection: 'row', gap: 9, alignItems: 'flex-start', paddingHorizontal: 6 },
  exampleText: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18 },
  understoodCard: { borderRadius: 21, borderWidth: 1, padding: 16, gap: 14 },
  understoodHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eyebrow: { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 0.8 },
  requestQuote: { fontFamily: 'Inter_600SemiBold', fontSize: 16, lineHeight: 23 },
  parsedList: { gap: 11 },
  parsed: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  parsedLabel: { fontFamily: 'Inter_400Regular', fontSize: 12 },
  parsedValue: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
});