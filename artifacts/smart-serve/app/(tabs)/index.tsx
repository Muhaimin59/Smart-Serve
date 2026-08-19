import { Feather } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { requestApi, useApp } from '@/context/AppContext';
import { IconButton, PrimaryButton, Screen, SearchField, SectionHeading, Tag, ProviderCard } from '@/components/SmartServeUI';

const categories = [
  { icon: 'zap', label: 'Electrical', color: 'gold' as const },
  { icon: 'droplet', label: 'Plumbing', color: 'green' as const },
  { icon: 'tool', label: 'Repairs', color: 'soft' as const },
  { icon: 'truck', label: 'Vehicle', color: 'soft' as const },
];

export default function HomeScreen() {
  const colors = useColors();
  const { role, user, token, activeBooking, available, setAvailable, locationLabel, setLocationLabel, providers } = useApp();
  const [dashboard, setDashboard] = useState<any>(null);
  const [services, setServices] = useState<Array<{ slug: string; name: string; icon?: string }>>([]);
  useEffect(() => { if (token) void requestApi<any>(role === 'provider' ? '/provider/location' : '/customer/location', {}, token).then((d) => { const l=d.location; if (l) setLocationLabel(l.area || l.city || l.formattedAddress || 'Selected location'); }).catch(() => undefined); }, [role, token]);
  useEffect(() => { if (role === 'provider' && token) void requestApi<any>('/provider/dashboard', {}, token).then(setDashboard).catch(() => undefined); }, [role, token]);
  useEffect(() => { if (role === 'customer') void requestApi<{ services: Array<{ slug: string; name: string; icon?: string }> }>('/services').then((result) => setServices(result.services.filter((service) => service.slug !== 'more').slice(0, 8))).catch(() => undefined); }, [role]);
  const [search, setSearch] = useState('');
  const [locationBusy, setLocationBusy] = useState(false);

  const useCurrentLocation = async () => {
    setLocationBusy(true);
    try {
      if (Platform.OS === 'web') {
        setLocationLabel('Current location enabled');
      } else {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('Location access needed', 'Choose your area manually to see nearby matches.');
          return;
        }
        await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setLocationLabel('Current location enabled');
      }
    } finally {
      setLocationBusy(false);
    }
  };

  if (role === 'provider') {
    return (
      <Screen>
        <View style={styles.providerHeader}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.eyebrow, { color: colors.primary }]}>PROVIDER CONSOLE</Text>
            <Text style={[styles.greeting, { color: colors.foreground }]}>Ready when you are, {formatFirstName(user?.displayName)}.</Text>
            <Pressable onPress={() => router.push('/location' as any)}><Text style={[styles.subtle, { color: colors.mutedForeground }]}>📍 {locationBusy ? 'Finding you…' : locationLabel}</Text></Pressable>
          </View>
          <View style={{ marginLeft: 12 }}><IconButton icon="bell" label="Notifications" onPress={() => router.push({ pathname: '/info', params: { kind: 'notifications' } } as any)} /></View>
        </View>
        <Pressable
          onPress={() => setAvailable(!available)}
          style={[styles.availabilityCard, { backgroundColor: available ? colors.primary : colors.secondary }]}
        >
          <View style={styles.availabilityIcon}>
            <Feather name={available ? 'radio' : 'moon'} size={20} color={available ? colors.primary : colors.mutedForeground} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.availabilityLabel, { color: available ? colors.primaryForeground : colors.foreground }]}>
              {available ? 'You are available' : 'You are unavailable'}
            </Text>
            <Text style={[styles.availabilityHint, { color: available ? '#d5f4e8' : colors.mutedForeground }]}>
              {available ? 'Smart Serve can send nearby requests' : 'Turn on when you are ready for work'}
            </Text>
          </View>
          <Feather name="chevron-right" size={19} color={available ? colors.primaryForeground : colors.foreground} />
        </Pressable>
        <View style={styles.statsRow}>
          <StatCard label="This month" value={`₹${dashboard?.earningsThisMonth ?? 0}`} icon="trending-up" />
          <StatCard label="Trust score" value={dashboard?.trustScore == null ? "Building" : `${dashboard.trustScore} / 100`} icon="shield" accent />
        </View>
        <SectionHeading title="Today's focus" action="View schedule" onAction={() => router.push('/activity')} />
        {dashboard?.requests?.[0] ? <View style={[styles.jobCard, { backgroundColor: colors.card, borderColor: colors.border }]}><View style={styles.jobTopRow}><Tag tone="gold">NEW REQUEST</Tag><Text style={[styles.jobDistance, { color: colors.mutedForeground }]}>New</Text></View><Text style={[styles.jobTitle, { color: colors.foreground }]}>{dashboard.requests[0].service}</Text><Text style={[styles.jobSubtitle, { color: colors.mutedForeground }]}>Request received · {dashboard.requests[0].status}</Text><View style={styles.jobFooter}><Text style={[styles.jobPrice, { color: colors.foreground }]}>{dashboard.requests[0].amount ? `₹${dashboard.requests[0].amount}` : 'Quote pending'}</Text><PrimaryButton style={styles.smallButton} onPress={() => router.push('/provider-job')} icon="arrow-up-right">Review</PrimaryButton></View></View> : <View style={[styles.jobCard, { backgroundColor: colors.card, borderColor: colors.border }]}><Text style={[styles.jobTitle, { color: colors.foreground }]}>No new service requests</Text><Text style={[styles.jobSubtitle, { color: colors.mutedForeground }]}>Stay available to receive nearby requests.</Text></View>}
        <SectionHeading title="Performance snapshot" />
        <View style={[styles.performanceCard, { backgroundColor: colors.secondary }]}>
          <View style={styles.performanceItem}><Text style={[styles.performanceValue, { color: colors.foreground }]}>{dashboard?.onTimeRate == null ? '0' : `${dashboard.onTimeRate}%`}</Text><Text style={[styles.performanceLabel, { color: colors.mutedForeground }]}>On-time arrival</Text></View>
          <View style={styles.performanceItem}><Text style={[styles.performanceValue, { color: colors.foreground }]}>{dashboard?.rating == null ? '—' : dashboard.rating}</Text><Text style={[styles.performanceLabel, { color: colors.mutedForeground }]}>Customer rating</Text></View>
          <View style={styles.performanceItem}><Text style={[styles.performanceValue, { color: colors.foreground }]}>{dashboard?.completedJobs ?? 0}</Text><Text style={[styles.performanceLabel, { color: colors.mutedForeground }]}>Jobs completed</Text></View>
        </View>
        <PrimaryButton secondary onPress={() => router.push('/provider-job')} icon="briefcase">Open job requests</PrimaryButton>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.headerRow}>
        <View style={styles.brandLockup}>
          <Image source={require('../../assets/images/icon.png')} style={styles.logo} />
          <View>
            <Text style={[styles.brandName, { color: colors.foreground }]}>Smart Serve</Text>
            <Pressable onPress={() => router.push('/location' as any)} style={styles.locationRow}>
              <Feather name="map-pin" size={12} color={colors.primary} />
              <Text style={[styles.locationText, { color: colors.mutedForeground }]}>{locationBusy ? 'Finding you…' : locationLabel}</Text>
              <Feather name="chevron-down" size={12} color={colors.mutedForeground} />
            </Pressable>
          </View>
        </View>
        <IconButton icon="bell" label="Notifications" onPress={() => router.push({ pathname: '/info', params: { kind: 'notifications' } } as any)} />
      </View>
      <View>
        <Text style={[styles.eyebrow, { color: colors.primary }]}>GOOD MORNING, {formatFirstName(user?.displayName)}</Text>
        <Text style={[styles.greeting, { color: colors.foreground }]}>What can we help with?</Text>
        <Text style={[styles.subtle, { color: colors.mutedForeground }]}>Find someone reliable, before the problem gets bigger.</Text>
      </View>
      <SearchField
        value={search}
        onChangeText={setSearch}
        onSubmitEditing={() => router.push({ pathname: '/providers', params: { query: search } })}
        placeholder="Try “leaking bathroom pipe”"
      />
      <View style={styles.aiRow}>
        <Pressable onPress={() => router.push('/scan')} style={[styles.aiCard, { backgroundColor: colors.primary }]}>
          <View style={styles.aiIcon}><Feather name="camera" size={18} color={colors.primary} /></View>
          <Text style={[styles.aiTitle, { color: colors.primaryForeground }]}>Scan a problem</Text>
          <Text style={[styles.aiCopy, { color: '#d5f4e8' }]}>Show us what’s wrong</Text>
          <Feather name="arrow-up-right" size={17} color={colors.primaryForeground} style={styles.cardArrow} />
        </Pressable>
        <Pressable onPress={() => router.push('/voice')} style={[styles.aiCard, { backgroundColor: colors.accent }]}>
          <View style={[styles.aiIcon, { backgroundColor: colors.primaryForeground }]}><Feather name="mic" size={18} color={colors.primary} /></View>
          <Text style={[styles.aiTitle, { color: colors.accentForeground }]}>Book with voice</Text>
          <Text style={[styles.aiCopy, { color: '#6d5b29' }]}>Just tell us what you need</Text>
          <Feather name="arrow-up-right" size={17} color={colors.accentForeground} style={styles.cardArrow} />
        </Pressable>
      </View>
      <Pressable onPress={() => router.push('/emergency')} style={[styles.emergencyBanner, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.emergencyIcon, { backgroundColor: '#fbe5e1' }]}><Feather name="alert-circle" size={20} color={colors.destructive} /></View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.emergencyTitle, { color: colors.foreground }]}>Need help right now?</Text>
          <Text style={[styles.emergencyCopy, { color: colors.mutedForeground }]}>Find a verified emergency provider nearby</Text>
        </View>
        <Feather name="chevron-right" size={19} color={colors.mutedForeground} />
      </Pressable>
      {activeBooking ? (
        <>
          <SectionHeading title="Active service" action="Track" onAction={() => router.push('/track')} />
          <Pressable onPress={() => router.push('/track')} style={[styles.activeCard, { backgroundColor: colors.secondary }]}>
            <View style={styles.activeIcon}><Feather name="navigation" size={18} color={colors.primary} /></View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.activeTitle, { color: colors.foreground }]}>{activeBooking.providerName} is on the way</Text>
              <Text style={[styles.activeSubtitle, { color: colors.mutedForeground }]}>{activeBooking.service}{activeBooking.eta ? ` · Arriving in ${activeBooking.eta}` : ' · Location updates available when GPS is shared'}</Text>
            </View>
            <Feather name="arrow-up-right" size={17} color={colors.primary} />
          </Pressable>
        </>
      ) : null}
      <SectionHeading title="Explore services" action="See all" onAction={() => router.push('/services' as any)} />
      <View style={styles.categoryGrid}>
        {(services.length ? services.map((service) => ({ icon: service.icon || 'tool', label: service.name, color: 'soft' as const })) : categories).map((category) => (
          <Pressable key={category.label} onPress={() => router.push({ pathname: '/providers', params: { query: category.label } })} style={[styles.category, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.categoryIcon, { backgroundColor: category.color === 'gold' ? colors.accent : colors.secondary }]}>
              <Feather name={category.icon as React.ComponentProps<typeof Feather>['name']} size={19} color={colors.primary} />
            </View>
            <Text style={[styles.categoryLabel, { color: colors.foreground }]}>{category.label}</Text>
          </Pressable>
        ))}
      </View>
      <SectionHeading title="Smart matches near you" action="View all" onAction={() => router.push({ pathname: '/providers', params: { query: 'Plumbing' } })} />
      <View style={{ gap: 10 }}>
        <Text style={[styles.subtle, { color: colors.mutedForeground }]}>Select a service to see verified providers matched from the marketplace.</Text>
      </View>
    </Screen>
  );
}

function StatCard({ label, value, icon, accent = false }: { label: string; value: string; icon: React.ComponentProps<typeof Feather>['name']; accent?: boolean }) {
  const colors = useColors();
  return (
    <View style={[styles.statCard, { backgroundColor: accent ? colors.accent : colors.card, borderColor: colors.border }]}>
      <Feather name={icon} size={18} color={colors.primary} />
      <Text style={[styles.statValue, { color: colors.foreground }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brandLockup: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { width: 44, height: 44, borderRadius: 14 },
  brandName: { fontFamily: 'Inter_700Bold', fontSize: 17 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  locationText: { fontFamily: 'Inter_500Medium', fontSize: 11 },
  eyebrow: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.2 },
  greeting: { fontFamily: 'Inter_700Bold', fontSize: 28, letterSpacing: -0.8, marginTop: 5 },
  subtle: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 20, marginTop: 6 },
  aiRow: { flexDirection: 'row', gap: 10 },
  aiCard: { flex: 1, minHeight: 126, borderRadius: 19, padding: 15, overflow: 'hidden' },
  aiIcon: { width: 33, height: 33, borderRadius: 12, backgroundColor: '#eff8f3', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  aiTitle: { fontFamily: 'Inter_700Bold', fontSize: 14 },
  aiCopy: { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 4, lineHeight: 16 },
  cardArrow: { position: 'absolute', right: 14, top: 16 },
  emergencyBanner: { minHeight: 70, borderRadius: 18, borderWidth: 1, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 11 },
  emergencyIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  emergencyTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  emergencyCopy: { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 3 },
  activeCard: { borderRadius: 18, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 11 },
  activeIcon: { width: 39, height: 39, borderRadius: 13, backgroundColor: '#f5fbf6', alignItems: 'center', justifyContent: 'center' },
  activeTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  activeSubtitle: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 3 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  category: { width: '48%', minHeight: 72, borderRadius: 17, borderWidth: 1, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  categoryIcon: { width: 36, height: 36, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  categoryLabel: { flex: 1, flexShrink: 1, fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  providerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  availabilityCard: { borderRadius: 20, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 12 },
  availabilityIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: '#eff8f3', alignItems: 'center', justifyContent: 'center' },
  availabilityLabel: { fontFamily: 'Inter_700Bold', fontSize: 15 },
  availabilityHint: { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 3 },
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: { flex: 1, borderRadius: 18, borderWidth: 1, padding: 14, gap: 7 },
  statValue: { fontFamily: 'Inter_700Bold', fontSize: 19 },
  statLabel: { fontFamily: 'Inter_400Regular', fontSize: 11 },
  jobCard: { borderRadius: 19, borderWidth: 1, padding: 15, gap: 8 },
  jobTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  jobDistance: { fontFamily: 'Inter_400Regular', fontSize: 11 },
  jobTitle: { fontFamily: 'Inter_700Bold', fontSize: 18, marginTop: 3 },
  jobSubtitle: { fontFamily: 'Inter_400Regular', fontSize: 12 },
  jobFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  jobPrice: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  smallButton: { minHeight: 36, paddingHorizontal: 13, borderRadius: 12 },
  performanceCard: { borderRadius: 19, padding: 16, flexDirection: 'row', justifyContent: 'space-between' },
  performanceItem: { flex: 1, gap: 5 },
  performanceValue: { fontFamily: 'Inter_700Bold', fontSize: 18 },
  performanceLabel: { fontFamily: 'Inter_400Regular', fontSize: 10 },
});
function formatFirstName(displayName?: string) { const firstName = displayName?.trim().split(/\s+/)[0]; return firstName ? firstName.toUpperCase() : 'THERE'; }
