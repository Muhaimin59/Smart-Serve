import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { PrimaryButton, Screen, Tag } from '@/components/SmartServeUI';

export default function BookingScreen() {
  const colors = useColors();
  const { activeBooking, setActiveBooking } = useApp();
  const booking = activeBooking;
  if (!booking) return <Screen><Text style={[styles.title, { color: colors.foreground }]}>No active booking request</Text><Text style={[styles.meta, { color: colors.mutedForeground }]}>Create a real service request to see it here.</Text><PrimaryButton onPress={() => router.replace('/(tabs)' as any)} icon="search">Find a service</PrimaryButton></Screen>;
  const confirm = () => {
    setActiveBooking({ id: activeBooking?.id ?? `booking-${Date.now()}`, providerName: booking.providerName, service: booking.service, status: 'on_the_way', eta: booking.eta, price: booking.price, location: booking.location });
    router.push('/track');
  };
  return (
    <Screen>
      <View style={styles.topRow}><Text style={[styles.title, { color: colors.foreground }]}>Review your request</Text><Tag tone="green">PROTECTED</Tag></View>
      <View style={[styles.providerRow, { backgroundColor: colors.secondary }]}>
        <View style={[styles.avatar, { backgroundColor: colors.primary }]}><Text style={[styles.avatarText, { color: colors.primaryForeground }]}>RK</Text></View>
        <View style={{ flex: 1 }}><Text style={[styles.name, { color: colors.foreground }]}>{booking.providerName}</Text><Text style={[styles.meta, { color: colors.mutedForeground }]}>Provider verification and arrival details will appear when available</Text></View>
        <Feather name="check-circle" size={18} color={colors.primary} />
      </View>
      <View style={[styles.detailCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <DetailRow icon="tool" label="Service" value={booking.service} />
        <DetailRow icon="map-pin" label="Location" value={booking.location} />
        <DetailRow icon="clock" label="Preferred time" value="Today · As soon as possible" />
      </View>
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Clear cost before you book</Text>
      <View style={[styles.costCard, { backgroundColor: colors.accent }]}>
        <View style={styles.costTop}><Text style={[styles.costLabel, { color: colors.accentForeground }]}>AI ESTIMATED RANGE</Text><Feather name="info" size={16} color={colors.accentForeground} /></View>
        <Text style={[styles.costValue, { color: colors.accentForeground }]}>{booking.price}</Text>
        <Text style={[styles.costNote, { color: '#6d5b29' }]}>Final quote only after inspection. You approve any change before work starts.</Text>
      </View>
      <View style={[styles.breakdown, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <CostRow label="Estimated labor" value="₹500–₹700" />
        <CostRow label="Visit & travel" value="Included" />
        <CostRow label="Materials" value="As needed" />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <CostRow label="Payment authorization" value="Not charged yet" strong />
      </View>
      <PrimaryButton onPress={confirm} icon="lock">Confirm & find provider</PrimaryButton>
      <Text style={[styles.disclaimer, { color: colors.mutedForeground }]}>Your payment is held securely and released after you confirm the service is complete.</Text>
    </Screen>
  );
}

function DetailRow({ icon, label, value }: { icon: React.ComponentProps<typeof Feather>['name']; label: string; value: string }) {
  const colors = useColors();
  return <View style={styles.detailRow}><Feather name={icon} size={17} color={colors.primary} /><View style={{ flex: 1 }}><Text style={[styles.rowLabel, { color: colors.mutedForeground }]}>{label}</Text><Text style={[styles.rowValue, { color: colors.foreground }]}>{value}</Text></View></View>;
}
function CostRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  const colors = useColors();
  return <View style={styles.costRow}><Text style={[styles.rowLabel, { color: colors.mutedForeground }]}>{label}</Text><Text style={[styles.rowValue, { color: strong ? colors.primary : colors.foreground }]}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 25, letterSpacing: -0.6 },
  providerRow: { borderRadius: 19, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 11 },
  avatar: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: 'Inter_700Bold', fontSize: 15 },
  name: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  meta: { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 4 },
  detailCard: { borderRadius: 19, borderWidth: 1, padding: 15, gap: 15 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  rowLabel: { fontFamily: 'Inter_400Regular', fontSize: 11 },
  rowValue: { fontFamily: 'Inter_600SemiBold', fontSize: 12, marginTop: 3 },
  sectionTitle: { fontFamily: 'Inter_700Bold', fontSize: 18 },
  costCard: { borderRadius: 19, padding: 16, gap: 8 },
  costTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  costLabel: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1 },
  costValue: { fontFamily: 'Inter_700Bold', fontSize: 28 },
  costNote: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 17 },
  breakdown: { borderRadius: 19, borderWidth: 1, padding: 15, gap: 12 },
  costRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  divider: { height: 1 },
  disclaimer: { fontFamily: 'Inter_400Regular', fontSize: 11, textAlign: 'center', lineHeight: 16, marginTop: -8 },
});