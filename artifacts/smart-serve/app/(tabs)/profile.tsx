import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { IconButton, PrimaryButton, Screen, Tag } from '@/components/SmartServeUI';

export default function ProfileScreen() {
  const colors = useColors();
  const { role, setRole } = useApp();
  const isProvider = role === 'provider';
  const switchRole = () => {
    setRole(isProvider ? 'customer' : 'provider');
    router.replace('/');
  };
  return (
    <Screen>
      <View style={styles.profileHeader}>
        <View style={[styles.profileAvatar, { backgroundColor: colors.primary }]}><Text style={[styles.profileInitials, { color: colors.primaryForeground }]}>{isProvider ? 'RK' : 'AD'}</Text></View>
        <View style={{ flex: 1 }}><Text style={[styles.profileName, { color: colors.foreground }]}>{isProvider ? 'Ravi Kumar' : 'Aditi Sharma'}</Text><Text style={[styles.profileMeta, { color: colors.mutedForeground }]}>{isProvider ? 'Verified service provider' : 'Customer account'}</Text></View>
        <IconButton icon="edit-2" label="Edit profile" />
      </View>
      <View style={[styles.trustCard, { backgroundColor: colors.secondary }]}>
        <View style={styles.trustTop}><View><Text style={[styles.trustCaption, { color: colors.primary }]}>SMART TRUST SCORE</Text><Text style={[styles.trustScore, { color: colors.foreground }]}>{isProvider ? '94' : '—'}<Text style={styles.trustOutOf}>/100</Text></Text></View><Feather name="shield" size={25} color={colors.primary} /></View>
        <Text style={[styles.trustCopy, { color: colors.mutedForeground }]}>{isProvider ? 'Your score is built from verified signals, not just ratings.' : 'Complete your first service to start building a trusted history.'}</Text>
        {isProvider ? <View style={styles.signalRow}><Tag tone="green">ID VERIFIED</Tag><Tag tone="green">96% ON TIME</Tag><Tag tone="green">4.9 RATING</Tag></View> : null}
      </View>
      <PrimaryButton secondary onPress={switchRole} icon={isProvider ? 'home' : 'briefcase'}>{isProvider ? 'Switch to customer view' : 'Open provider console'}</PrimaryButton>
      <Text style={[styles.menuLabel, { color: colors.mutedForeground }]}>ACCOUNT</Text>
      <MenuRow icon="map-pin" title="Saved locations" value="2 saved" />
      <MenuRow icon="credit-card" title="Payments" value="UPI · •••• 4821" />
      <MenuRow icon="globe" title="Language" value="English" />
      <MenuRow icon="bell" title="Notifications" value="On" />
      <Text style={[styles.menuLabel, { color: colors.mutedForeground }]}>TRUST & SAFETY</Text>
      <MenuRow icon="lock" title="Privacy & safety" />
      <MenuRow icon="help-circle" title="Help center" />
      <MenuRow icon="file-text" title="Policies & protection" />
    </Screen>
  );
}

function MenuRow({ icon, title, value }: { icon: React.ComponentProps<typeof Feather>['name']; title: string; value?: string }) {
  const colors = useColors();
  return (
    <Pressable style={styles.menuRow}>
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