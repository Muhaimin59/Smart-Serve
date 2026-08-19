import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import MapView, { Marker, Region } from 'react-native-maps';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { requestApi, useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { IconButton, PrimaryButton, Screen, Tag } from '@/components/SmartServeUI';

export default function TrackScreen() {
  const colors = useColors();
  const { activeBooking, token } = useApp();
  const [providerLocation, setProviderLocation] = useState<any>(null);
  useEffect(() => { if (!token || !activeBooking?.id) return; const load=()=>void requestApi<any>(`/bookings/${activeBooking.id}/provider-location`,{},token).then(d=>setProviderLocation(d.location)).catch(()=>undefined); load(); const timer=setInterval(load,30000); return ()=>clearInterval(timer); }, [token, activeBooking?.id]);
  const booking = activeBooking;
  if (!booking) return <Screen><Text style={[styles.topTitle, { color: colors.foreground }]}>No active service to track</Text><Text style={[styles.providerMeta, { color: colors.mutedForeground }]}>Create a real service request to see it here.</Text><PrimaryButton onPress={() => router.replace('/(tabs)' as any)} icon="search">Find a service</PrimaryButton></Screen>;
  return (
    <Screen>
      <View style={styles.topRow}><IconButton icon="arrow-left" label="Back" onPress={() => router.back()} /><Text style={[styles.topTitle, { color: colors.foreground }]}>Live service</Text><IconButton icon="more-horizontal" label="More options" /></View>
      <View style={styles.mapCard}>{activeBooking.latitude && activeBooking.longitude ? <MapView style={{flex:1}} region={{latitude:activeBooking.latitude,longitude:activeBooking.longitude,latitudeDelta:.03,longitudeDelta:.03} as Region} showsUserLocation><Marker coordinate={{latitude:activeBooking.latitude,longitude:activeBooking.longitude}} title="Service location"/><>{providerLocation?.latitude && <Marker coordinate={{latitude:Number(providerLocation.latitude),longitude:Number(providerLocation.longitude)}} title="Provider"/>}</></MapView> : <View style={styles.mapFallback}><Text style={[styles.mapLabel,{color:colors.mutedForeground}]}>Service location is unavailable.</Text></View>}</View>
      <View style={styles.etaRow}><View><Text style={[styles.eyebrow, { color: colors.primary }]}>ON THE WAY</Text><Text style={[styles.etaTitle, { color: colors.foreground }]}>{providerLocation ? 'Provider location sharing is active' : 'Waiting for provider location'}</Text><Text style={[styles.etaCopy, { color: colors.mutedForeground }]}>Provider GPS sharing is limited to this active booking</Text></View><Tag tone="green">VERIFIED</Tag></View>
      <View style={[styles.providerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.avatar, { backgroundColor: colors.primary }]}><Text style={[styles.avatarText, { color: colors.primaryForeground }]}>RK</Text></View>
        <View style={{ flex: 1 }}><Text style={[styles.providerName, { color: colors.foreground }]}>{booking.providerName}</Text><Text style={[styles.providerMeta, { color: colors.mutedForeground }]}>Trust metrics will appear after completed reviews</Text></View>
        <IconButton icon="message-circle" label="Open chat" onPress={() => router.push('/chat')} />
      </View>
      <View style={[styles.timeline, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <TimelineItem icon="check" title="Request confirmed" meta="Payment authorization ready" done />
        <TimelineItem icon="navigation" title="Provider location" meta={providerLocation ? 'Latest GPS location received' : 'Waiting for provider GPS'} active />
        <TimelineItem icon="tool" title="Service starts" meta="You approve the final quote first" />
      </View>
      <PrimaryButton secondary onPress={() => router.push('/chat')} icon="message-circle">Message provider</PrimaryButton>
      <Pressable><Text style={[styles.cancel, { color: colors.destructive }]}>Need to cancel this service?</Text></Pressable>
    </Screen>
  );
}

function TimelineItem({ icon, title, meta, done, active }: { icon: React.ComponentProps<typeof Feather>['name']; title: string; meta: string; done?: boolean; active?: boolean }) {
  const colors = useColors();
  return <View style={styles.timelineItem}><View style={[styles.timelineIcon, { backgroundColor: done ? colors.primary : active ? colors.accent : colors.muted }]}><Feather name={icon} size={14} color={done ? colors.primaryForeground : colors.foreground} /></View><View style={{ flex: 1 }}><Text style={[styles.timelineTitle, { color: colors.foreground }]}>{title}</Text><Text style={[styles.timelineMeta, { color: colors.mutedForeground }]}>{meta}</Text></View></View>;
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topTitle: { fontFamily: 'Inter_700Bold', fontSize: 17 },
  mapFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  mapCard: { height: 250, borderRadius: 22, overflow: 'hidden', position: 'relative' },
  mapGrid: { ...StyleSheet.absoluteFillObject, opacity: 0.6 },
  routeLine: { position: 'absolute', width: 260, height: 3, backgroundColor: '#8bbbae', transform: [{ rotate: '23deg' }], top: 120, left: -15 },
  routeLineTwo: { position: 'absolute', width: 270, height: 3, backgroundColor: '#a7c9be', transform: [{ rotate: '-34deg' }], top: 95, left: 90 },
  mapPill: { position: 'absolute', top: 14, left: 14, backgroundColor: '#ffffff', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 6 },
  mapPillText: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  pin: { position: 'absolute', width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', top: 83, left: 205 },
  homePin: { position: 'absolute', width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', bottom: 53, left: 78 },
  mapLabel: { position: 'absolute', bottom: 15, right: 17, fontFamily: 'Inter_500Medium', fontSize: 11 },
  etaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  eyebrow: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.2 },
  etaTitle: { fontFamily: 'Inter_700Bold', fontSize: 24, marginTop: 4 },
  etaCopy: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 4 },
  providerCard: { borderRadius: 19, borderWidth: 1, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 11 },
  avatar: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: 'Inter_700Bold', fontSize: 15 },
  providerName: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  providerMeta: { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 4 },
  timeline: { borderRadius: 19, borderWidth: 1, padding: 15, gap: 18 },
  timelineItem: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  timelineIcon: { width: 30, height: 30, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  timelineTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  timelineMeta: { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 3 },
  cancel: { fontFamily: 'Inter_600SemiBold', fontSize: 12, textAlign: 'center' },
});