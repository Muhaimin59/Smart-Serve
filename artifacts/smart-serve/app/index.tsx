import { Redirect } from 'expo-router'; import { useApp } from '@/context/AppContext';
export default function Index() { const { user, isRestoringAuth } = useApp(); if (isRestoringAuth) return null; return <Redirect href={(user ? '/(tabs)' : '/login') as any} />; }
