import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { PrimaryButton, Screen, Tag } from '@/components/SmartServeUI';

export default function ScanScreen() {
  const colors = useColors();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const pickImage = async (camera: boolean) => {
    try {
      const result = camera
        ? await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.8 })
        : await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, quality: 0.8 });
      if (!result.canceled && result.assets[0]?.uri) {
        setImageUri(result.assets[0].uri);
        setAnalyzing(true);
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setTimeout(() => setAnalyzing(false), 950);
      }
    } catch {
      Alert.alert('Could not open camera', 'You can choose a photo from your library instead.');
    }
  };

  return (
    <Screen>
      <View style={styles.topRow}><Pressable onPress={() => router.back()}><Feather name="arrow-left" size={22} color={colors.foreground} /></Pressable><Text style={[styles.topTitle, { color: colors.foreground }]}>Scan your problem</Text><View style={{ width: 22 }} /></View>
      <View style={[styles.introCard, { backgroundColor: colors.primary }]}>
        <View style={styles.introIcon}><Feather name="aperture" size={21} color={colors.primary} /></View>
        <Text style={[styles.introTitle, { color: colors.primaryForeground }]}>Help us understand what’s wrong</Text>
        <Text style={[styles.introCopy, { color: '#d5f4e8' }]}>Take a clear photo. Smart Serve will suggest a service, safety steps, and a price range — always as an estimate.</Text>
      </View>
      {imageUri ? (
        <View style={[styles.previewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Image source={{ uri: imageUri }} style={styles.previewImage} />
          <View style={styles.previewOverlay}><Tag tone="green">{analyzing ? 'ANALYZING…' : 'PHOTO READY'}</Tag></View>
        </View>
      ) : (
        <View style={[styles.cameraPlaceholder, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <View style={styles.cameraTarget}><Feather name="camera" size={28} color={colors.primary} /></View>
          <Text style={[styles.placeholderTitle, { color: colors.foreground }]}>No photo yet</Text>
          <Text style={[styles.placeholderCopy, { color: colors.mutedForeground }]}>Good lighting helps us make a better suggestion.</Text>
        </View>
      )}
      <View style={styles.actions}>
        <PrimaryButton onPress={() => pickImage(true)} icon="camera">Take a photo</PrimaryButton>
        <PrimaryButton onPress={() => pickImage(false)} secondary icon="image">Choose from library</PrimaryButton>
      </View>
      {imageUri && !analyzing ? (
        <View style={[styles.diagnosisCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.diagnosisHeader}><View><Text style={[styles.diagnosisEyebrow, { color: colors.primary }]}>AI-ASSISTED ESTIMATE</Text><Text style={[styles.diagnosisTitle, { color: colors.foreground }]}>Possible pipe leakage</Text></View><View style={[styles.confidence, { backgroundColor: colors.accent }]}><Text style={[styles.confidenceText, { color: colors.accentForeground }]}>MEDIUM CONFIDENCE</Text></View></View>
          <Text style={[styles.diagnosisCopy, { color: colors.mutedForeground }]}>A visible water leak may be coming from a loose connection under the sink. A professional inspection is still needed.</Text>
          <View style={styles.resultRows}><ResultRow label="Recommended service" value="Plumber" /><ResultRow label="Suggested urgency" value="Today" /><ResultRow label="Estimated repair" value="₹500–₹1,500" /><ResultRow label="Safety note" value="Keep the area dry" /></View>
          <PrimaryButton onPress={() => router.push({ pathname: '/providers', params: { query: 'Plumbing' } })} icon="users">Find suitable providers</PrimaryButton>
        </View>
      ) : null}
    </Screen>
  );
}

function ResultRow({ label, value }: { label: string; value: string }) {
  const colors = useColors();
  return <View style={styles.resultRow}><Text style={[styles.resultLabel, { color: colors.mutedForeground }]}>{label}</Text><Text style={[styles.resultValue, { color: colors.foreground }]}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topTitle: { fontFamily: 'Inter_700Bold', fontSize: 17 },
  introCard: { borderRadius: 21, padding: 18, gap: 9 },
  introIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: '#eff8f3', alignItems: 'center', justifyContent: 'center', marginBottom: 3 },
  introTitle: { fontFamily: 'Inter_700Bold', fontSize: 21, lineHeight: 27 },
  introCopy: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18 },
  cameraPlaceholder: { minHeight: 220, borderRadius: 21, borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', padding: 28 },
  cameraTarget: { width: 70, height: 70, borderRadius: 24, backgroundColor: '#f5fbf6', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  placeholderTitle: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  placeholderCopy: { fontFamily: 'Inter_400Regular', fontSize: 12, textAlign: 'center', lineHeight: 18, marginTop: 5 },
  previewCard: { borderRadius: 21, borderWidth: 1, overflow: 'hidden', position: 'relative' },
  previewImage: { width: '100%', height: 230 },
  previewOverlay: { position: 'absolute', left: 14, top: 14 },
  actions: { gap: 9 },
  diagnosisCard: { borderRadius: 21, borderWidth: 1, padding: 16, gap: 14 },
  diagnosisHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  diagnosisEyebrow: { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1 },
  diagnosisTitle: { fontFamily: 'Inter_700Bold', fontSize: 19, marginTop: 5 },
  confidence: { borderRadius: 9, paddingHorizontal: 8, paddingVertical: 6 },
  confidenceText: { fontFamily: 'Inter_700Bold', fontSize: 8, letterSpacing: 0.4 },
  diagnosisCopy: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18 },
  resultRows: { gap: 10 },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  resultLabel: { fontFamily: 'Inter_400Regular', fontSize: 12 },
  resultValue: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
});