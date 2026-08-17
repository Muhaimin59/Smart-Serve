import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { PrimaryButton, Screen, Tag } from '@/components/SmartServeUI';

export default function ProviderProfileScreen() {
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { providers, setActiveBooking } = useApp();
  const provider = providers.find((item) => item.id === id) ?? providers[0];
  const book = () => {
    setActiveBooking({ id: `booking-${Date.now()}`, providerName: provider.name, service: 'Kitchen sink repair', status: 'confirmed', eta: provider.eta, price: provider.price, location: 'Indiranagar, Bengaluru' });
    router.push('/booking');
  };
  return (
    <Screen>
      <View style={styles.topRow}><Pressable onPress={() => router.back()}><Feather name="arrow-left" size={22} color={colors.foreground} /></Pressable><Text style={[styles.topTitle, { color: colors.foreground }]}>Provider profile</Text><Feather name="share-2" size={19} color={colors.foreground} /></View>
      <View style={styles.profileIntro}>
        <View style={[styles.avatar, { backgroundColor: colors.primary }]}><Text style={[styles.avatarText, { color: colors.primaryForeground }]}>{provider.initials}</Text></View>
        <Text style={[styles.name, { color: colors.foreground }]}>{provider.name}</Text>
        <View style={styles.verifiedRow}><Feather name="check-circle" size={15} color={colors.primary} /><Text style={[styles.verified, { color: colors.primary }]}>Identity & skill verified</Text></View>
        <Text style={[styles.service, { color: colors.mutedForeground }]}>{provider.service} · {provider.distance} away</Text>
      </View>
      <View style={styles.statStrip}>
        <ProfileStat value={`${provider.trustScore}`} label="Trust score" strong />
        <ProfileStat value={provider.rating} label="Rating" />
        <ProfileStat value="96%" label="On time" />
        <ProfileStat value="186" label="Jobs" />
      </View>
      <View style={[styles.explainCard, { backgroundColor: colors.secondary }]}>
        <View style={styles.explainTitle}><Feather name="shield" size={18} color={colors.primary} /><Text style={[styles.explainTitleText, { color: colors.foreground }]}>Why Smart Serve recommends them</Text></View>
        <Text style={[styles.explainCopy, { color: colors.mutedForeground }]}>{provider.reason}. This score weighs verified signals and service consistency, not just public ratings.</Text>
        <View style={styles.signalList}><Signal text="Identity verified" /><Signal text="Low cancellation rate" /><Signal text="Transparent quotes" /></View>
      </View>
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Transparent estimate</Text>
      <View style={[styles.priceCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.priceRow}><Text style={[styles.priceLabel, { color: colors.mutedForeground }]}>AI estimated range</Text><Text style={[styles.priceValue, { color: colors.foreground }]}>{provider.price}</Text></View>
        <View style={styles.priceRow}><Text style={[styles.priceLabel, { color: colors.mutedForeground }]}>Visit charge</Text><Text style={[styles.priceValue, { color: colors.foreground }]}>Included</Text></View>
        <View style={styles.priceRow}><Text style={[styles.priceLabel, { color: colors.mutedForeground }]}>Final quote</Text><Tag tone="gold">After inspection</Tag></View>
      </View>
      <PrimaryButton onPress={book} icon="calendar">Request this provider</PrimaryButton>
      <Text style={[styles.disclaimer, { color: colors.mutedForeground }]}>You review the final quote before any extra work begins.</Text>
    </Screen>
  );
}

function ProfileStat({ value, label, strong }: { value: string; label: string; strong?: boolean }) {
  const colors = useColors();
  return <View style={styles.profileStat}><Text style={[styles.profileStatValue, { color: strong ? colors.primary : colors.foreground }]}>{value}</Text><Text style={[styles.profileStatLabel, { color: colors.mutedForeground }]}>{label}</Text></View>;
}
function Signal({ text }: { text: string }) {
  const colors = useColors();
  return <View style={styles.signal}><Feather name="check" size={13} color={colors.primary} /><Text style={[styles.signalText, { color: colors.foreground }]}>{text}</Text></View>;
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topTitle: { fontFamily: 'Inter_700Bold', fontSize: 17 },
  profileIntro: { alignItems: 'center', gap: 6, paddingTop: 3 },
  avatar: { width: 75, height: 75, borderRadius: 27, alignItems: 'center', justifyContent: 'center', marginBottom: 3 },
  avatarText: { fontFamily: 'Inter_700Bold', fontSize: 25 },
  name: { fontFamily: 'Inter_700Bold', fontSize: 23 },
  verifiedRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  verified: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  service: { fontFamily: 'Inter_400Regular', fontSize: 12 },
  statStrip: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 9 },
  profileStat: { alignItems: 'center', gap: 4 },
  profileStatValue: { fontFamily: 'Inter_700Bold', fontSize: 17 },
  profileStatLabel: { fontFamily: 'Inter_400Regular', fontSize: 10 },
  explainCard: { borderRadius: 19, padding: 16, gap: 9 },
  explainTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  explainTitleText: { fontFamily: 'Inter_700Bold', fontSize: 14 },
  explainCopy: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18 },
  signalList: { gap: 5 },
  signal: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  signalText: { fontFamily: 'Inter_500Medium', fontSize: 12 },
  sectionTitle: { fontFamily: 'Inter_700Bold', fontSize: 18 },
  priceCard: { borderRadius: 18, borderWidth: 1, padding: 15, gap: 13 },
  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  priceLabel: { fontFamily: 'Inter_400Regular', fontSize: 12 },
  priceValue: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  disclaimer: { fontFamily: 'Inter_400Regular', fontSize: 11, textAlign: 'center', lineHeight: 16, marginTop: -8 },
});