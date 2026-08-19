import React, { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, useFonts } from '@expo-google-fonts/inter';
import { router, Stack, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { AppProvider, useApp } from '@/context/AppContext';

SplashScreen.preventAutoHideAsync();
const queryClient = new QueryClient();
const customerPaths = ['/edit-profile', '/saved-locations', '/info', '/location', '/providers', '/provider', '/booking', '/track', '/chat', '/scan', '/voice', '/emergency'];
const providerPaths = ['/provider-job', '/provider-onboarding'];

function AuthRouteGuard() {
  const { user, role, isRestoringAuth } = useApp();
  const pathname = usePathname();
  useEffect(() => {
    if (isRestoringAuth) return;
    const isAuthRoute = pathname === '/login' || pathname === '/signup';
    if (!user && !isAuthRoute) { router.replace('/login' as never); return; }
    if (user && isAuthRoute) { router.replace('/' as never); return; }
    if (user && role === 'provider' && customerPaths.includes(pathname)) { router.replace('/' as never); return; }
    if (user && role === 'customer' && providerPaths.includes(pathname)) { router.replace('/' as never); }
  }, [isRestoringAuth, pathname, role, user]);
  return null;
}

function RootLayoutNav() {
  const { isRestoringAuth } = useApp();
  if (isRestoringAuth) return null;
  return <>
    <AuthRouteGuard />
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="edit-profile" />
      <Stack.Screen name="saved-locations" />
      <Stack.Screen name="info" />
      <Stack.Screen name="services" />
      <Stack.Screen name="location" />
      <Stack.Screen name="providers" />
      <Stack.Screen name="provider" />
      <Stack.Screen name="booking" />
      <Stack.Screen name="track" />
      <Stack.Screen name="chat" />
      <Stack.Screen name="scan" />
      <Stack.Screen name="voice" />
      <Stack.Screen name="emergency" />
      <Stack.Screen name="provider-job" />
      <Stack.Screen name="provider-onboarding" />
    </Stack>
  </>;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  useEffect(() => { if (fontsLoaded || fontError) void SplashScreen.hideAsync(); }, [fontsLoaded, fontError]);
  if (!fontsLoaded && !fontError) return null;
  return <SafeAreaProvider><ErrorBoundary><QueryClientProvider client={queryClient}><AppProvider><GestureHandlerRootView style={{ flex: 1 }}><KeyboardProvider><RootLayoutNav /></KeyboardProvider></GestureHandlerRootView></AppProvider></QueryClientProvider></ErrorBoundary></SafeAreaProvider>;
}
