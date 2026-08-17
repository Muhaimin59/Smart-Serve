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
    // Legacy aliases (kept for backward compatibility)
    text: '#17352e',
    tint: '#0f766e',

    // Core surfaces
    background: '#f6f8f3',
    foreground: '#17352e',

    // Cards / elevated surfaces
    card: '#ffffff',
    cardForeground: '#17352e',

    // Primary action color (buttons, links, active states)
    primary: '#0f766e',
    primaryForeground: '#ffffff',

    // Secondary / less-emphasis interactive surfaces
    secondary: '#e6f1ed',
    secondaryForeground: '#17463e',

    // Muted / subdued elements (dividers, timestamps, placeholders)
    muted: '#edf2ed',
    mutedForeground: '#6c7f78',

    // Accent highlights (badges, selected items, focus rings)
    accent: '#f4c95d',
    accentForeground: '#17352e',

    // Destructive actions (delete, error states)
    destructive: '#c2413b',
    destructiveForeground: '#ffffff',

    // Borders and input outlines
    border: '#d9e3dc',
    input: '#d9e3dc',
  },

  // Border radius (in px). Sync from the sibling web artifact's --radius
  // CSS variable. This value applies to cards, buttons, inputs, and modals.
  radius: 16,
};

export default colors;
