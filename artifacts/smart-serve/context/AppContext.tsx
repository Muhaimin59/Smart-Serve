import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type AppRole = 'customer' | 'provider';

export type Provider = {
  id: string;
  name: string;
  service: string;
  initials: string;
  trustScore: number;
  distance: string;
  price: string;
  eta: string;
  rating: string;
  verified: boolean;
  available: boolean;
  reason: string;
};

export type Booking = {
  id: string;
  providerName: string;
  service: string;
  status: 'confirmed' | 'on_the_way' | 'completed';
  eta: string;
  price: string;
  location: string;
  emergency?: boolean;
};

type AppContextValue = {
  role: AppRole;
  setRole: (role: AppRole) => void;
  activeBooking: Booking | null;
  setActiveBooking: (booking: Booking | null) => void;
  available: boolean;
  setAvailable: (value: boolean) => void;
  locationLabel: string;
  setLocationLabel: (value: string) => void;
  providers: Provider[];
};

const providers: Provider[] = [
  {
    id: 'ravi',
    name: 'Ravi Kumar',
    service: 'Certified electrician',
    initials: 'RK',
    trustScore: 94,
    distance: '1.8 km',
    price: '₹700–₹1,000',
    eta: '12 min',
    rating: '4.9',
    verified: true,
    available: true,
    reason: 'Fast nearby match with excellent on-time history',
  },
  {
    id: 'meera',
    name: 'Meera Nair',
    service: 'Home repair specialist',
    initials: 'MN',
    trustScore: 91,
    distance: '2.4 km',
    price: '₹600–₹900',
    eta: '18 min',
    rating: '4.8',
    verified: true,
    available: true,
    reason: 'Strong repeat-customer rate for kitchen repairs',
  },
  {
    id: 'sanjay',
    name: 'Sanjay Auto Care',
    service: 'Vehicle assistance',
    initials: 'SA',
    trustScore: 89,
    distance: '3.1 km',
    price: '₹500–₹1,200',
    eta: '24 min',
    rating: '4.7',
    verified: true,
    available: false,
    reason: 'Highly rated for transparent parts and labor quotes',
  },
];

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<AppRole>('customer');
  const [activeBooking, setActiveBookingState] = useState<Booking | null>(null);
  const [available, setAvailableState] = useState(true);
  const [locationLabel, setLocationLabel] = useState('Indiranagar, Bengaluru');

  useEffect(() => {
    void (async () => {
      const [savedRole, savedBooking, savedAvailability, savedLocation] = await Promise.all([
        AsyncStorage.getItem('smart-serve-role'),
        AsyncStorage.getItem('smart-serve-booking'),
        AsyncStorage.getItem('smart-serve-availability'),
        AsyncStorage.getItem('smart-serve-location'),
      ]);
      if (savedRole === 'customer' || savedRole === 'provider') setRoleState(savedRole);
      if (savedBooking) setActiveBookingState(JSON.parse(savedBooking) as Booking);
      if (savedAvailability !== null) setAvailableState(savedAvailability === 'true');
      if (savedLocation) setLocationLabel(savedLocation);
    })();
  }, []);

  const setRole = (nextRole: AppRole) => {
    setRoleState(nextRole);
    void AsyncStorage.setItem('smart-serve-role', nextRole);
  };

  const setActiveBooking = (booking: Booking | null) => {
    setActiveBookingState(booking);
    if (booking) void AsyncStorage.setItem('smart-serve-booking', JSON.stringify(booking));
    else void AsyncStorage.removeItem('smart-serve-booking');
  };

  const setAvailable = (value: boolean) => {
    setAvailableState(value);
    void AsyncStorage.setItem('smart-serve-availability', String(value));
  };

  const updateLocationLabel = (value: string) => {
    setLocationLabel(value);
    void AsyncStorage.setItem('smart-serve-location', value);
  };

  const value = useMemo(
    () => ({
      role,
      setRole,
      activeBooking,
      setActiveBooking,
      available,
      setAvailable,
      locationLabel,
      setLocationLabel: updateLocationLabel,
      providers,
    }),
    [role, activeBooking, available, locationLabel],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used inside AppProvider');
  return context;
}