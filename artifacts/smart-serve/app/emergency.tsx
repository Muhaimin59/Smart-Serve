import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { PrimaryButton, Screen, Tag } from '@/components/SmartServeUI';

const options = [
  { icon: 'droplet', title: 'Water leakage', copy: 'Pipe burst or major leak' },
  { icon: 'zap', title: 'Electrical issue', copy: 'Sparks, outage, burning smell' },
  { icon: 'truck', title: 'Vehicle breakdown', copy: 'Stranded or unsafe to drive' },
  { icon: 'lock', title: 'Lock or access', copy: 'Locked out or urgent entry' },
];

export default function EmergencyScreen() {
  const colors = useColors();
  const { setActiveBooking } = useApp();
  const [selected, setSelected] = useState('Water leakage');
  const requestHelp = () => {
    setActiveBooking({ id: `emergency-${Date.now()}`, providerName: 'Nearest verified responder', service: selected, status: 'on_the_way', eta: '9 min', price: '₹900–₹1,600', location: 'Indiranagar, Bengaluru', emergency: true });
    router.push('/track');
  };
  return (
    <Screen>
      <View style={styles.topRow}><Pressable onPress={() => router.back()}><Feather name="arrow-left" size={22} color={colors.foreground} /></Pressable><Text style={[styles.topTitle, { color: colors.foreground }]}>Emergency help</Text><Tag tone="gold">FAST TRACK</Tag></View>
      <View style={[styles.alertHero, { backgroundColor: colors.destructive }]}>
        <View style={styles.alertIcon}><Feather name="alert-triangle" size={25} color={colors.destructive} /></View>
        <Text style={[styles.alertTitle, { color: colors.destructiveForeground }]}>Get help without the wait</Text>
        <Text style={[styles.alertCopy, { color: '#ffe4e1' }]}>We’ll find the nearest verified responder, show the estimate, and keep you updated.</Text>
      </View>
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>What happened?</Text>
      <View style={styles.options}>
        {options.map((option) => {
          const active = selected === option.title;
          return <Pressable key={option.title} onPress={() => setSelected(option.title)} style={[styles.option, { backgroundColor: active ? colors.secondary : colors.card, borderColor: active ? colors.primary : colors.border }]}><View style={[styles.optionIcon, { backgroundColor: active ? colors.primary : colors.muted }]}><Feather name={option.icon as React.ComponentProps<typeof Feather>['name']} size={18} color={active ? colors.primaryForeground : colors.primary} /></View><View style={{ flex: 1 }}><Text style={[styles.optionTitle, { color: colors.foreground }]}>{option.title}</Text><Text style={[styles.optionCopy, { color: colors.mutedForeground }]}>{option.copy}</Text></View>{active ? <Feather name="check-circle" size={18} color={colors.primary} /> : null}</Pressable>;
        })}
      </View>
      <View style={[styles.estimate, { backgroundColor: colors.card, borderColor: colors.border }]}><View><Text style={[styles.estimateLabel, { color: colors.mutedForeground }]}>EXPECTED ARRIVAL</Text><Text style={[styles.estimateValue, { color: colors.foreground }]}>Within 9–15 min</Text></View><View style={{ alignItems: 'flex-end' }}><Text style={[styles.estimateLabel, { color: colors.mutedForeground }]}>ESTIMATED RANGE</Text><Text style={[styles.estimateValue, { color: colors.foreground }]}>₹900–₹1,600</Text></View></View>
      <PrimaryButton danger onPress={requestHelp} icon="radio">Find emergency help now</PrimaryButton>
      <Text style={[styles.disclaimer, { color: colors.mutedForeground }]}>For immediate danger to life or property, contact local emergency services first.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  topTitle: { fontFamily: 'Inter_700Bold', fontSize: 17 },
  alertHero: { borderRadius: 23, padding: 19, gap: 9 },
  alertIcon: { width: 44, height: 44, borderRadius: 15, backgroundColor: '#fff3ee', alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  alertTitle: { fontFamily: 'Inter_700Bold', fontSize: 24 },
  alertCopy: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18 },
  sectionTitle: { fontFamily: 'Inter_700Bold', fontSize: 18 },
  options: { gap: 9 },
  option: { borderRadius: 18, borderWidth: 1, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 11 },
  optionIcon: { width: 39, height: 39, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  optionTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  optionCopy: { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 3 },
  estimate: { borderRadius: 18, borderWidth: 1, padding: 15, flexDirection: 'row', justifyContent: 'space-between' },
  estimateLabel: { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 0.7 },
  estimateValue: { fontFamily: 'Inter_700Bold', fontSize: 15, marginTop: 5 },
  disclaimer: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: -7 },
});