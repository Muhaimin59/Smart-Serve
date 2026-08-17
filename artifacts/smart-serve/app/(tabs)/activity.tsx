import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { Screen, SectionHeading, Tag } from '@/components/SmartServeUI';

export default function ActivityScreen() {
  const colors = useColors();
  const { role, activeBooking } = useApp();
  const isProvider = role === 'provider';
  return (
    <Screen>
      <View>
        <Text style={[styles.eyebrow, { color: colors.primary }]}>{isProvider ? 'YOUR WORK' : 'YOUR SERVICES'}</Text>
        <Text style={[styles.title, { color: colors.foreground }]}>{isProvider ? 'Activity & earnings' : 'Activity'}</Text>
        <Text style={[styles.subtle, { color: colors.mutedForeground }]}>{isProvider ? 'Keep every job, quote, and payout in view.' : 'Everything you’ve booked, in one place.'}</Text>
      </View>
      {isProvider ? (
        <>
          <View style={[styles.earningsHero, { backgroundColor: colors.primary }]}>
            <View style={styles.earningsTop}><Text style={[styles.earningsCaption, { color: '#d5f4e8' }]}>AVAILABLE TO PAY OUT</Text><Feather name="more-horizontal" size={20} color="#d5f4e8" /></View>
            <Text style={[styles.earningsValue, { color: colors.primaryForeground }]}>₹28,450</Text>
            <View style={styles.earningsBottom}><Text style={[styles.earningsCaption, { color: '#d5f4e8' }]}>+18% from last month</Text><Feather name="trending-up" size={17} color={colors.primaryForeground} /></View>
          </View>
          <SectionHeading title="Recent jobs" action="See all" />
          <JobRow title="Kitchen sink leakage" meta="Completed today · ₹850" status="PAID" />
          <JobRow title="Ceiling fan installation" meta="Yesterday · ₹1,200" status="PAID" />
          <JobRow title="Laptop setup" meta="Mon, 12 Aug · ₹600" status="PAID" />
        </>
      ) : (
        <>
          {activeBooking ? (
            <Pressable onPress={() => router.push('/track')} style={[styles.currentCard, { backgroundColor: colors.secondary }]}>
              <View style={styles.currentIcon}><Feather name="navigation" size={19} color={colors.primary} /></View>
              <View style={{ flex: 1 }}><Text style={[styles.currentTitle, { color: colors.foreground }]}>Active · {activeBooking.service}</Text><Text style={[styles.currentMeta, { color: colors.mutedForeground }]}>{activeBooking.providerName} · Arriving in {activeBooking.eta}</Text></View>
              <Feather name="chevron-right" size={18} color={colors.primary} />
            </Pressable>
          ) : null}
          <SectionHeading title="Past services" action="Filter" />
          <JobRow title="Kitchen sink leakage" meta="12 Aug 2026 · ₹850" status="COMPLETED" />
          <JobRow title="AC servicing" meta="03 Aug 2026 · ₹1,100" status="COMPLETED" />
          <JobRow title="Bike puncture assistance" meta="28 Jul 2026 · ₹350" status="COMPLETED" />
          <View style={[styles.protectionCard, { backgroundColor: colors.accent }]}>
            <Feather name="shield" size={21} color={colors.accentForeground} />
            <View style={{ flex: 1 }}><Text style={[styles.protectionTitle, { color: colors.accentForeground }]}>Your service protection</Text><Text style={[styles.protectionCopy, { color: '#6d5b29' }]}>Eligible jobs include revisit coverage. Tap any completed service to review it.</Text></View>
          </View>
        </>
      )}
    </Screen>
  );
}

function JobRow({ title, meta, status }: { title: string; meta: string; status: string }) {
  const colors = useColors();
  return (
    <View style={[styles.jobRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.jobIcon, { backgroundColor: colors.secondary }]}><Feather name="tool" size={17} color={colors.primary} /></View>
      <View style={{ flex: 1 }}><Text style={[styles.jobTitle, { color: colors.foreground }]}>{title}</Text><Text style={[styles.jobMeta, { color: colors.mutedForeground }]}>{meta}</Text></View>
      <Tag tone="green">{status}</Tag>
    </View>
  );
}

const styles = StyleSheet.create({
  eyebrow: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.2 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 28, letterSpacing: -0.8, marginTop: 5 },
  subtle: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 20, marginTop: 6 },
  earningsHero: { borderRadius: 21, padding: 18, gap: 15 },
  earningsTop: { flexDirection: 'row', justifyContent: 'space-between' },
  earningsCaption: { fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: 0.7 },
  earningsValue: { fontFamily: 'Inter_700Bold', fontSize: 32 },
  earningsBottom: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  currentCard: { borderRadius: 18, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 11 },
  currentIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: '#f5fbf6', alignItems: 'center', justifyContent: 'center' },
  currentTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  currentMeta: { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 3 },
  jobRow: { borderRadius: 18, borderWidth: 1, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 11 },
  jobIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  jobTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  jobMeta: { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 4 },
  protectionCard: { borderRadius: 19, padding: 16, flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  protectionTitle: { fontFamily: 'Inter_700Bold', fontSize: 14 },
  protectionCopy: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16, marginTop: 4 },
});