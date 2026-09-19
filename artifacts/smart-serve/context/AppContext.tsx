import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
export type AppRole = 'customer' | 'provider';
export type Provider = { id: string; name: string; service: string; initials: string; trustScore: number; distance: string; price: string; eta: string; rating: string; verified: boolean; available: boolean; reason: string; };
export type Booking = { id: string; providerName: string; service: string; status: 'confirmed' | 'on_the_way' | 'completed'; eta: string; price: string; location: string; latitude?: number; longitude?: number; emergency?: boolean; };
export type AuthUser = { id: string; email: string; role: AppRole; displayName: string; createdAt: string };
type SessionResponse = { token: string; expiresAt: string; user: AuthUser };
type AppContextValue = { role: AppRole; setRole: (role: AppRole) => void; activeBooking: Booking | null; setActiveBooking: (booking: Booking | null) => void; available: boolean; setAvailable: (value: boolean) => void; locationLabel: string; setLocationLabel: (value: string) => void; providers: Provider[]; user: AuthUser | null; token: string | null; isRestoringAuth: boolean; login: (email: string, password: string) => Promise<void>; signup: (input: { displayName: string; email: string; password: string; role: AppRole }) => Promise<void>; logout: () => Promise<void>; };
const providers: Provider[] = [];
const TOKEN_KEY = 'smart-serve-session-token';
function getApiBaseUrl() {
  // Centralized, build-time configuration. Production builds MUST set
  // EXPO_PUBLIC_API_URL (see eas.json profiles) — the app never hardcodes
  // a backend address.
  const configured = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/$/, '');
  if (configured) return configured;
  if (Platform.OS === 'web') return '';
  // Dev-only fallback for Expo Go / `pnpm dev` on an emulator or LAN device.
  // In production builds __DEV__ is false, so a missing EXPO_PUBLIC_API_URL
  // fails loudly (network error) instead of silently hitting a local address.
  if (__DEV__) {
    const hostUri = Constants.expoConfig?.hostUri?.split(':')[0];
    return hostUri ? `http://${hostUri}:5000` : 'http://10.0.2.2:5000';
  }
  return '';
}
const apiUrl = (path: string) => `${getApiBaseUrl()}/api${path}`;
export async function requestApi<T>(path: string, init: RequestInit = {}, token?: string | null): Promise<T> {
  let response: Response;
  if (__DEV__) console.log('[Smart Serve API] request URL', apiUrl(path), init.method ?? 'GET');
  try {
    response = await fetch(apiUrl(path), { ...init, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers } });
  } catch (error) {
    if (__DEV__) console.warn('[Smart Serve API] network failure', { path, error });
    throw new Error('Unable to connect to Smart Serve server.');
  }
  const raw = await response.text();
  let data: unknown = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = null; }
  if (!response.ok) {
    const message = data && typeof data === 'object' && 'message' in data && typeof data.message === 'string' ? data.message : `Smart Serve server returned HTTP ${response.status}.`;
    throw new Error(message);
  }
  if (data === null || data === undefined) throw new Error('Smart Serve server returned an empty response.');
  if (__DEV__) console.log('[Smart Serve API] response', path, data);
  return data as T;
}
const AppContext = createContext<AppContextValue | null>(null);
export function AppProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<AppRole>('customer'); const [activeBooking, setActiveBookingState] = useState<Booking | null>(null); const [available, setAvailableState] = useState(true); const [locationLabel, setLocationLabel] = useState('Select your location'); const [user, setUser] = useState<AuthUser | null>(null); const [token, setToken] = useState<string | null>(null); const [isRestoringAuth, setIsRestoringAuth] = useState(true);
  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const [savedToken, savedBooking, savedAvailability, savedLocation] = await Promise.all([
          AsyncStorage.getItem(TOKEN_KEY),
          AsyncStorage.getItem('smart-serve-booking'),
          AsyncStorage.getItem('smart-serve-availability'),
          AsyncStorage.getItem('smart-serve-location'),
        ]);
        if (!mounted) return;
        let parsedBooking: Booking | null = null;
        if (savedBooking) { try { parsedBooking = JSON.parse(savedBooking) as Booking; } catch { await AsyncStorage.removeItem('smart-serve-booking'); } }
        if (savedAvailability !== null) setAvailableState(savedAvailability === 'true');
        if (savedLocation) setLocationLabel(savedLocation);
        if (savedToken) {
          try {
            const result = await requestApi<{ user: AuthUser }>('/auth/me', {}, savedToken);
            if (mounted) { setToken(savedToken); setUser(result.user); setRoleState(result.user.role); if (parsedBooking?.id) { try { const current = await requestApi<any>(`/bookings/${parsedBooking.id}`, {}, savedToken); if (current.booking && ['requested','accepted','in_progress'].includes(current.booking.status)) setActiveBookingState(parsedBooking); else await AsyncStorage.removeItem('smart-serve-booking'); } catch { await AsyncStorage.removeItem('smart-serve-booking'); } } }
          } catch { await AsyncStorage.removeItem(TOKEN_KEY); }
        }
      } catch {
        // Local storage and the API are optional during first render.
      } finally {
        if (mounted) setIsRestoringAuth(false);
      }
    })();
    return () => { mounted = false; };
  }, []);
  const saveSession = async (session: SessionResponse | null | undefined) => {
    if (!session || typeof session !== 'object' || typeof session.token !== 'string' || !session.token || !session.user || (session.user.role !== 'customer' && session.user.role !== 'provider')) {
      if (__DEV__) console.error('[Smart Serve Auth] invalid session response', session);
      throw new Error('Smart Serve server did not return a valid session.');
    }
    await AsyncStorage.setItem(TOKEN_KEY, session.token);
    setToken(session.token); setUser(session.user); setRoleState(session.user.role);
  };
  const value = useMemo(() => ({ role, setRole: (next: AppRole) => setRoleState(next), activeBooking, setActiveBooking: (booking: Booking | null) => { setActiveBookingState(booking); void (booking ? AsyncStorage.setItem('smart-serve-booking', JSON.stringify(booking)) : AsyncStorage.removeItem('smart-serve-booking')); }, available, setAvailable: (next: boolean) => { setAvailableState(next); void AsyncStorage.setItem('smart-serve-availability', String(next)); if (token && role === 'provider') void requestApi('/provider/availability', { method: 'PUT', body: JSON.stringify({ available: next }) }, token).catch(() => setAvailableState(!next)); }, locationLabel, setLocationLabel: (next: string) => { setLocationLabel(next); void AsyncStorage.setItem('smart-serve-location', next); }, providers, user, token, isRestoringAuth, login: async (email: string, password: string) => saveSession(await requestApi<SessionResponse>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })), signup: async (input: { displayName: string; email: string; password: string; role: AppRole }) => saveSession(await requestApi<SessionResponse>('/auth/signup', { method: 'POST', body: JSON.stringify(input) })), logout: async () => { try { if (token) await requestApi<void>('/auth/logout', { method: 'POST' }, token); } finally { await AsyncStorage.removeItem(TOKEN_KEY); setToken(null); setUser(null); } } }), [role, activeBooking, available, locationLabel, user, token, isRestoringAuth]);
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
export function useApp() { const context = useContext(AppContext); if (!context) throw new Error('useApp must be used inside AppProvider'); return context; }
