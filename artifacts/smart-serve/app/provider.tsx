import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { requestApi, useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { PrimaryButton, Screen, Tag } from '@/components/SmartServeUI';

export default function ProviderProfileScreen() {
  const colors = useColors();
  const { id, serviceId } = useLocalSearchParams<{ id?: string; serviceId?: string }>();
  const { token, setActiveBooking } = useApp();
  const [customerLocation, setCustomerLocation] = useState<any>(null);
  const [provider, setProvider] = useState<any>(null);
  useEffect(() => { if (token) void requestApi<any>('/customer/location', {}, token).then((d) => setCustomerLocation(d.location)).catch(() => undefined); }, [token]);
  useEffect(() => { if (token && id) void requestApi<any>(`/providers/${id}`, {}, token).then((data) => setProvider(data.provider)).catch(() => setProvider(null)); }, [token, id]);
  if (!provider) return <Screen><Text style={[styles.name, { color: colors.foreground }]}>Provider not available</Text><Text style={[styles.service, { color: colors.mutedForeground }]}>This provider is not currently available for this service.</Text></Screen>;
  const book = async () => {
    if (!token || !provider?.skills?.[0]?.id || !customerLocation) { router.push('/location' as any); return; }
    try { const result = await requestApi<any>('/bookings', { method: 'POST', body: JSON.stringify({ serviceId: serviceId || provider.skills[0].id, providerId: provider.id, latitude: customerLocation?.latitude, longitude: customerLocation?.longitude, locationAddress: customerLocation?.formattedAddress, locationArea: customerLocation?.area, locationCity: customerLocation?.city, locationState: customerLocation?.state, locationPostalCode: customerLocation?.postalCode, problemDescription: 'Service requested from provider profile' }) }, token); const b=result.booking; setActiveBooking({ id:b.id, providerName:provider.name, service:provider.skills?.[0]?.name||'Service', status:'confirmed', eta:'', price:'Not available', location:b.locationAddress||customerLocation.formattedAddress||'Selected location', latitude:Number(b.latitude), longitude:Number(b.longitude) }); router.replace('/(tabs)/activity' as any); } catch { }
  };
  return (
    <Screen>
      <View style={styles.topRow}><Pressable onPress={() => router.back()}><Feather name="arrow-left" size={22} color={colors.foreground} /></Pressable><Text style={[styles.topTitle, { color: colors.foreground }]}>Provider profile</Text><Feather name="share-2" size={19} color={colors.foreground} /></View>
      <View style={styles.profileIntro}>
        <View style={[styles.avatar, { backgroundColor: colors.primary }]}><Text style={[styles.avatarText, { color: colors.primaryForeground }]}>{provider.initials}</Text></View>
        <Text style={[styles.name, { color: colors.foreground }]}>{provider.name}</Text>
        <View style={styles.verifiedRow}><Feather name="check-circle" size={15} color={colors.primary} /><Text style={[styles.verified, { color: colors.warning }]}>Verification status unavailable</Text></View>
        <Text style={[styles.service, { color: colors.mutedForeground }]}>{provider.skills?.map((x:any) => x.name).join(', ') || 'Services'} · {provider.available ? 'Available' : 'Unavailable'}</Text>
      </View>
      <View style={styles.statStrip}>
        <ProfileStat value="Building" label="Trust score" strong />
        <ProfileStat value="—" label="Rating" />
        <ProfileStat value="—" label="On time" />
        <ProfileStat value="0" label="Jobs" />
      </View>
      <View style={[styles.explainCard, { backgroundColor: colors.secondary }]}>
        <View style={styles.explainTitle}><Feather name="shield" size={18} color={colors.primary} /><Text style={[styles.explainTitleText, { color: colors.foreground }]}>Why Smart Serve recommends them</Text></View>
        <Text style={[styles.explainCopy, { color: colors.mutedForeground }]}>Provider data is sourced from Smart Serve. Trust metrics will appear after completed jobs and verified reviews.</Text>
        <View style={styles.signalList}><Signal text="Verification pending" /><Signal text="Service details available after onboarding" /></View>
      </View>
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Transparent estimate</Text>
      <View style={[styles.priceCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.priceRow}><Text style={[styles.priceLabel, { color: colors.mutedForeground }]}>AI estimated range</Text><Text style={[styles.priceValue, { color: colors.foreground }]}>{provider.startingPrice ? `₹${provider.startingPrice}` : 'Not available'}</Text></View>
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