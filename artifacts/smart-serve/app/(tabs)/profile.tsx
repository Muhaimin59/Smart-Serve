import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { requestApi, useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { IconButton, PrimaryButton, Screen, Tag } from '@/components/SmartServeUI';

export default function ProfileScreen() {
  const colors = useColors();
  const { role, user, token, logout } = useApp();
  const [providerProfile, setProviderProfile] = useState<any>(null);
  const [dashboard, setDashboard] = useState<any>(null);
  useEffect(() => { if (role === 'provider' && token) { void requestApi<any>('/provider/profile', {}, token).then(setProviderProfile).catch(() => undefined); void requestApi<any>('/provider/dashboard', {}, token).then(setDashboard).catch(() => undefined); } }, [role, token]);
  const isProvider = role === 'provider';
  const signOut = async () => { await logout(); router.replace('/login' as never); };
  const initials = user?.displayName?.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'SS';
  return (
    <Screen>
      <View style={styles.profileHeader}>
        <View style={[styles.profileAvatar, { backgroundColor: colors.primary }]}><Text style={[styles.profileInitials, { color: colors.primaryForeground }]}>{initials}</Text></View>
        <View style={{ flex: 1 }}><Text style={[styles.profileName, { color: colors.foreground }]}>{user?.displayName ?? 'Smart Serve user'}</Text><Text style={[styles.profileMeta, { color: colors.mutedForeground }]}>{isProvider ? (providerProfile?.profile?.verificationStatus === 'verified' ? 'Verified service provider' : 'Provider · Pending verification') : 'Customer account'}</Text></View>
        <IconButton icon="edit-2" label="Edit profile" onPress={() => router.push('/edit-profile' as any)} />
      </View>
      <View style={[styles.trustCard, { backgroundColor: colors.secondary }]}>
        <View style={styles.trustTop}><View><Text style={[styles.trustCaption, { color: colors.primary }]}>SMART TRUST SCORE</Text><Text style={[styles.trustScore, { color: colors.foreground }]}>{isProvider ? (dashboard?.trustScore == null ? 'Building' : dashboard.trustScore) : '—'}<Text style={styles.trustOutOf}>/100</Text></Text></View><Feather name="shield" size={25} color={colors.primary} /></View>
        <Text style={[styles.trustCopy, { color: colors.mutedForeground }]}>{isProvider ? (dashboard?.trustScore == null ? 'Not enough activity yet.' : 'Your score is built from verified signals, not just ratings.') : 'Complete your first service to start building a trusted history.'}</Text>
        {isProvider ? <View style={styles.signalRow}><Tag tone="gold">{providerProfile?.profile?.verificationStatus === 'verified' ? 'VERIFIED' : 'PENDING VERIFICATION'}</Tag><Tag tone="green">{dashboard?.completedJobs ?? 0} JOBS</Tag></View> : null}
      </View>
      <PrimaryButton secondary onPress={signOut} icon="log-out">Sign out</PrimaryButton>
      <Text style={[styles.menuLabel, { color: colors.mutedForeground }]}>ACCOUNT</Text>
      <MenuRow icon="map-pin" title="Saved locations" value="Manage" onPress={() => router.push('/saved-locations' as any)} />
      <MenuRow icon="credit-card" title="Payment methods" value="Not configured" onPress={() => router.push({ pathname: '/info', params: { kind: 'payments' } } as any)} />
      <MenuRow icon="globe" title="Language" value="English" onPress={() => router.push({ pathname: '/info', params: { kind: 'language' } } as any)} />
      <MenuRow icon="bell" title="Notifications" value="Not configured" onPress={() => router.push({ pathname: '/info', params: { kind: 'notifications' } } as any)} />
      <Text style={[styles.menuLabel, { color: colors.mutedForeground }]}>TRUST & SAFETY</Text>
      <MenuRow icon="lock" title="Privacy & safety" onPress={() => router.push({ pathname: '/info', params: { kind: 'privacy' } } as any)} />
      <MenuRow icon="help-circle" title="Help center" onPress={() => router.push({ pathname: '/info', params: { kind: 'help' } } as any)} />
      <MenuRow icon="file-text" title="Policies & protection" onPress={() => router.push({ pathname: '/info', params: { kind: 'policies' } } as any)} />
    </Screen>
  );
}

function MenuRow({ icon, title, value, onPress }: { icon: React.ComponentProps<typeof Feather>['name']; title: string; value?: string; onPress?: () => void }) {
  const colors = useColors();
  return (
    <Pressable onPress={onPress} style={styles.menuRow}>
      <View style={[styles.menuIcon, { backgroundColor: colors.muted }]}><Feather name={icon} size={17} color={colors.primary} /></View>
      <Text style={[styles.menuTitle, { color: colors.foreground }]}>{title}</Text>
      {value ? <Text style={[styles.menuValue, { color: colors.mutedForeground }]}>{value}</Text> : null}
      <Feather name="chevron-right" size={17} color={colors.mutedForeground} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  profileHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  profileAvatar: { width: 60, height: 60, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  profileInitials: { fontFamily: 'Inter_700Bold', fontSize: 18 },
  profileName: { fontFamily: 'Inter_700Bold', fontSize: 19 },
  profileMeta: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 4 },
  trustCard: { borderRadius: 20, padding: 17, gap: 10 },
  trustTop: { flexDirection: 'row', justifyContent: 'space-between' },
  trustCaption: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1 },
  trustScore: { fontFamily: 'Inter_700Bold', fontSize: 35, marginTop: 4 },
  trustOutOf: { fontFamily: 'Inter_500Medium', fontSize: 15 },
  trustCopy: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18 },
  signalRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  menuLabel: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.2, marginTop: 6 },
  menuRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 11 },
  menuIcon: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  menuTitle: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 14 },
  menuValue: { fontFamily: 'Inter_400Regular', fontSize: 11 },
});