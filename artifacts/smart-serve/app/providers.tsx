import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { IconButton, PrimaryButton, ProviderCard, Screen, SearchField, SectionHeading, Tag } from '@/components/SmartServeUI';

export default function ProvidersScreen() {
  const colors = useColors();
  const { providers } = useApp();
  const params = useLocalSearchParams<{ query?: string }>();
  const query = typeof params.query === 'string' ? params.query : '';
  const matches = useMemo(() => providers, [providers]);
  return (
    <Screen>
      <View style={styles.topRow}><IconButton icon="arrow-left" label="Back" onPress={() => router.back()} /><View style={{ flex: 1, marginLeft: 10 }}><Text style={[styles.eyebrow, { color: colors.primary }]}>SMART MATCH</Text><Text style={[styles.title, { color: colors.foreground }]}>People you can trust</Text></View><IconButton icon="map" label="Map view" /></View>
      <SearchField value={query} onChangeText={() => undefined} placeholder="Search a service" />
      <View style={[styles.estimateCard, { backgroundColor: colors.secondary }]}>
        <View style={styles.estimateHeader}><View style={[styles.aiDot, { backgroundColor: colors.primary }]}><Feather name="zap" size={14} color={colors.primaryForeground} /></View><Text style={[styles.estimateTitle, { color: colors.foreground }]}>Smart estimate for {query || 'your request'}</Text></View>
        <Text style={[styles.estimatePrice, { color: colors.foreground }]}>₹700 – ₹1,000</Text>
        <View style={styles.estimateMeta}><Tag tone="green">MEDIUM CONFIDENCE</Tag><Text style={[styles.estimateNote, { color: colors.mutedForeground }]}>Includes typical labor + visit</Text></View>
      </View>
      <SectionHeading title={`${matches.length} recommended providers`} action="Sort: Best match" />
      <Text style={[styles.explain, { color: colors.mutedForeground }]}>Ranked by trust, distance, availability, and fit for the request — not rating alone.</Text>
      <View style={{ gap: 10 }}>
        {matches.map((provider, index) => (
          <View key={provider.id} style={{ gap: 8 }}>
            {index === 0 ? <View style={styles.bestMatch}><Feather name="star" size={13} color={colors.accentForeground} /><Text style={[styles.bestMatchText, { color: colors.accentForeground }]}>BEST MATCH FOR YOU</Text></View> : null}
            <ProviderCard provider={provider} onPress={() => router.push({ pathname: '/provider', params: { id: provider.id } })} />
            <View style={styles.matchReason}><Feather name="info" size={12} color={colors.primary} /><Text style={[styles.matchReasonText, { color: colors.mutedForeground }]}>{provider.reason}</Text></View>
          </View>
        ))}
      </View>
      <PrimaryButton secondary onPress={() => router.push('/voice')} icon="mic">Describe a different request</PrimaryButton>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center' },
  eyebrow: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.2 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 24, letterSpacing: -0.6, marginTop: 4 },
  estimateCard: { borderRadius: 20, padding: 16, gap: 10 },
  estimateHeader: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  aiDot: { width: 27, height: 27, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  estimateTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  estimatePrice: { fontFamily: 'Inter_700Bold', fontSize: 25 },
  estimateMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  estimateNote: { fontFamily: 'Inter_400Regular', fontSize: 11 },
  explain: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18, marginTop: -10 },
  bestMatch: { alignSelf: 'flex-start', backgroundColor: '#f4c95d', borderRadius: 7, paddingHorizontal: 8, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 4 },
  bestMatchText: { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 0.5 },
  matchReason: { flexDirection: 'row', alignItems: 'center', gap: 5, marginLeft: 4 },
  matchReasonText: { fontFamily: 'Inter_400Regular', fontSize: 11 },
});