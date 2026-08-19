import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import * as Location from 'expo-location';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { requestApi, useApp } from '@/context/AppContext';
import { PrimaryButton, Screen, Tag } from '@/components/SmartServeUI';

export default function ProviderJobScreen() {
  const colors = useColors();
  const { token } = useApp();
  const [request, setRequest] = useState<any>(null);
  useEffect(() => { if (token) void requestApi<any>('/provider/dashboard', {}, token).then((data) => setRequest(data.requests?.[0] ?? null)).catch(() => undefined); }, [token]);
  useEffect(() => { let sub: Location.LocationSubscription | undefined; const start = async () => { if (!token || !request?.id || !['accepted','in_progress'].includes(request.status)) return; const permission=await Location.requestForegroundPermissionsAsync(); if (!permission.granted) return; sub=await Location.watchPositionAsync({ accuracy: Location.Accuracy.Balanced, timeInterval: 30000, distanceInterval: 50 }, (p) => { void requestApi(`/bookings/${request.id}/provider-location`, { method:'PUT', body:JSON.stringify({ latitude:String(p.coords.latitude), longitude:String(p.coords.longitude) }) }, token); }); }; void start(); return () => { sub?.remove(); }; }, [token, request?.id, request?.status]);
  const updateStatus = async (status: string) => { if (!token || !request?.id) return; try { const data = await requestApi<any>(`/bookings/${request.id}/status`, { method: 'PATCH', body: JSON.stringify({ status, ...(status === 'completed' ? { finalAmount: request.amount ?? undefined } : {}) }) }, token); setRequest((current:any) => ({ ...current, ...data.booking })); if (status === 'completed') router.replace('/'); } catch { } };
  const accept = () => updateStatus('accepted');
  if (!request) return <Screen><View style={styles.topRow}><Pressable onPress={() => router.back()}><Feather name="arrow-left" size={22} color={colors.foreground} /></Pressable><Text style={[styles.topTitle, { color: colors.foreground }]}>Job request</Text><View /></View><View style={[styles.detailCard, { backgroundColor: colors.card, borderColor: colors.border }]}><Text style={[styles.heroTitle, { color: colors.foreground }]}>No new service requests</Text><Text style={[styles.heroMeta, { color: colors.mutedForeground }]}>Stay available to receive nearby requests.</Text></View></Screen>;
  return (
    <Screen>
      <View style={styles.topRow}><Pressable onPress={() => router.back()}><Feather name="arrow-left" size={22} color={colors.foreground} /></Pressable><Text style={[styles.topTitle, { color: colors.foreground }]}>Job request</Text><Tag tone="gold">NEW</Tag></View>
      <View style={[styles.hero, { backgroundColor: colors.secondary }]}>
        <Text style={[styles.heroEyebrow, { color: colors.primary }]}>MATCHED FOR YOU</Text>
        <Text style={[styles.heroTitle, { color: colors.foreground }]}>{request.service}</Text>
        <Text style={[styles.heroMeta, { color: colors.mutedForeground }]}>{request.status} · Request received</Text>
      </View>
      <View style={[styles.customerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.customerAvatar, { backgroundColor: colors.accent }]}><Text style={[styles.customerInitials, { color: colors.accentForeground }]}>AS</Text></View>
        <View style={{ flex: 1 }}><Text style={[styles.customerName, { color: colors.foreground }]}>Customer details available after acceptance</Text><Text style={[styles.customerMeta, { color: colors.mutedForeground }]}>Verified customer · 2 previous services</Text></View>
        <Feather name="shield" size={18} color={colors.primary} />
      </View>
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>What Smart Serve knows</Text>
      <View style={[styles.detailCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Detail icon="droplet" label="Possible issue" value={request.problemDescription || 'No description provided'} />
        <Detail icon="clock" label="Expected duration" value="To be confirmed" />
        <Detail icon="credit-card" label="Transparent estimate" value={request.amount ? `₹${request.amount}` : "Quote pending"} />
        <Detail icon="map-pin" label="Customer location" value={request.address || 'Location not provided'} />
      </View>
      <View style={[styles.tip, { backgroundColor: colors.accent }]}><Feather name="info" size={17} color={colors.accentForeground} /><Text style={[styles.tipText, { color: colors.accentForeground }]}>The customer approves your final quote before extra work begins.</Text></View>
      {request.status === 'requested' && <PrimaryButton onPress={accept} icon="check">Accept job request</PrimaryButton>}
      {request.status === 'accepted' && <PrimaryButton onPress={() => updateStatus('in_progress')} icon="play">Start service</PrimaryButton>}
      {request.status === 'in_progress' && <PrimaryButton onPress={() => updateStatus('completed')} icon="check-circle">Complete service</PrimaryButton>}
      <Pressable><Text style={[styles.decline, { color: colors.mutedForeground }]}>Not a good fit? Decline respectfully</Text></Pressable>
    </Screen>
  );
}

function Detail({ icon, label, value }: { icon: React.ComponentProps<typeof Feather>['name']; label: string; value: string }) {
  const colors = useColors();
  return <View style={styles.detail}><Feather name={icon} size={17} color={colors.primary} /><View style={{ flex: 1 }}><Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>{label}</Text><Text style={[styles.detailValue, { color: colors.foreground }]}>{value}</Text></View></View>;
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topTitle: { fontFamily: 'Inter_700Bold', fontSize: 17 },
  hero: { borderRadius: 21, padding: 18, gap: 7 },
  heroEyebrow: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.1 },
  heroTitle: { fontFamily: 'Inter_700Bold', fontSize: 24 },
  heroMeta: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18 },
  customerCard: { borderRadius: 19, borderWidth: 1, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 11 },
  customerAvatar: { width: 45, height: 45, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  customerInitials: { fontFamily: 'Inter_700Bold', fontSize: 14 },
  customerName: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  customerMeta: { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 4 },
  sectionTitle: { fontFamily: 'Inter_700Bold', fontSize: 18 },
  detailCard: { borderRadius: 19, borderWidth: 1, padding: 15, gap: 15 },
  detail: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  detailLabel: { fontFamily: 'Inter_400Regular', fontSize: 11 },
  detailValue: { fontFamily: 'Inter_600SemiBold', fontSize: 12, marginTop: 3 },
  tip: { borderRadius: 17, padding: 14, flexDirection: 'row', gap: 9, alignItems: 'center' },
  tipText: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 11, lineHeight: 16 },
  decline: { fontFamily: 'Inter_600SemiBold', fontSize: 12, textAlign: 'center' },
});