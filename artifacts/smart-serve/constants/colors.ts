/**
 * Semantic design tokens for the mobile app.
 *
 * These tokens mirror the naming conventions used in web artifacts (index.css)
 * so that multi-artifact projects share a cohesive visual identity.
 *
 * Replace the placeholder values below with values that match the project's
 * brand. If a sibling web artifact exists, read its index.css and convert the
 * HSL values to hex so both artifacts use the same palette.
 *
 * To add dark mode, add a `dark` key with the same token names.
 * The useColors() hook will automatically pick it up.
 */

const colors = {
  light: {
    // Brand
    text: '#F4F7FB',
    tint: '#21C7B7',

    // Main surfaces
    background: '#09111F',
    foreground: '#F4F7FB',

    // Cards
    card: '#111D30',
    cardForeground: '#F4F7FB',

    // Primary — Smart Serve teal
    primary: '#20C7B7',
    primaryForeground: '#061A18',

    // Secondary surfaces
    secondary: '#17263D',
    secondaryForeground: '#DCE7F5',

    // Muted
    muted: '#1B2940',
    mutedForeground: '#8FA1B7',

    // Accent — warm coral/orange
    accent: '#FF8B67',
    accentForeground: '#1B1110',

    // Danger
    destructive: '#FF5F67',
    destructiveForeground: '#FFFFFF',

    // Borders
    border: '#263650',
    input: '#263650',

    // Additional premium colors
    success: '#35D49A',
    warning: '#F7C95B',
    info: '#65A9FF',

    // Navigation
    navigation: '#0D1728',
    navigationActive: '#20C7B7',
    navigationInactive: '#71839A',

    // Overlay / glass
    overlay: 'rgba(255,255,255,0.06)',
    overlayStrong: 'rgba(255,255,255,0.10)',
  },

  radius: 22,
};

export default colors;