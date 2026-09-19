import type { ExpoConfig } from "expo/config";

/**
 * Smart Serve — Expo app configuration (production-ready).
 *
 * Single source of truth (replaces the former static app.json).
 * Deployment-only values live here; no app features or branding are changed.
 *
 * Environment variables (all read at BUILD time by EAS):
 *   EXPO_PUBLIC_API_URL             — deployed backend origin (public value).
 *                                     Set in the eas.json profiles or EAS
 *                                     dashboard; must NOT be localhost.
 *   EXPO_PUBLIC_ANDROID_MAPS_API_KEY — Google "Maps SDK for Android" key,
 *                                     required for the map screens on real
 *                                     devices. Kept out of the repo on
 *                                     purpose: provide it as an EAS secret.
 */

// Origin of the deployed web app (deep links / universal links).
// UPDATE THIS when the backend + web app move to a permanent domain.
const WEB_ORIGIN = "https://5000-i9wf9z32tdrpfzpff55gv.e2b.app";

const mapsApiKey = process.env.EXPO_PUBLIC_ANDROID_MAPS_API_KEY?.trim();

const plugins: ExpoConfig["plugins"] = [
  ["expo-router", { origin: WEB_ORIGIN }],
  "expo-font",
  "expo-web-browser",
  [
    "expo-location",
    {
      locationWhenInUsePermission:
        "Smart Serve uses your location to match nearby providers and show live job tracking.",
    },
  ],
  [
    "expo-image-picker",
    {
      photosPermission:
        "Smart Serve can attach photos to your bookings and provider verification.",
      cameraPermission: "Smart Serve can take photos for bookings and verification.",
      // The app captures photos only (no video) — do NOT request the
      // microphone permission for the camera.
      microphonePermission: false,
    },
  ],
  // Deployment-only: keeps the Android permission set limited to what the
  // app actually uses (see plugins/with-smartserve-manifest.js).
  "./plugins/with-smartserve-manifest",
];

// Google Maps SDK for Android key — only inlined when provided at build time.
// iOS uses Apple Maps and needs no key; Android requires this for the map
// screens (location picker + live tracking) to render on a real device.
if (mapsApiKey) {
  plugins.push(["react-native-maps", { androidGoogleMapsApiKey: mapsApiKey }]);
}

const config: ExpoConfig = {
  name: "Smart Serve",
  slug: "smart-serve",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "smart-serve",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  splash: {
    image: "./assets/images/icon.png",
    resizeMode: "contain",
    backgroundColor: "#f6f8f3",
  },
  ios: {
    supportsTablet: false,
  },
  android: {
    package: "com.smartserve.app",
    versionCode: 1,
  },
  web: {
    favicon: "./assets/images/favicon.png",
  },
  plugins,
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
};

export default config;
