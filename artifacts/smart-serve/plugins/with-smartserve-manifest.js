/**
 * Smart Serve — Android manifest cleanup (deployment-only).
 *
 * The Android project is generated fresh on every EAS build (CNG), so
 * permission changes MUST live in a config plugin like this one —
 * editing android/AndroidManifest.xml by hand would not survive a build.
 *
 * Rule: only request permissions the app actually uses.
 *   - LOCATION  -> live tracking + provider matching (expo-location)
 *   - CAMERA    -> photo capture in app/scan.tsx (expo-image-picker)
 *   - VIBRATE   -> haptics (expo-haptics)
 *   - INTERNET  -> API + Socket.IO
 * Removed: RECORD_AUDIO (no real mic usage), SYSTEM_ALERT_WINDOW (unused).
 *
 * Uses withDangerousMod (final prebuild step) so it sees the fully
 * assembled manifest, including the base template permissions.
 */
const fs = require("fs");
const path = require("path");
const { withDangerousMod } = require("expo/config-plugins");

const REMOVE = [
  "android.permission.RECORD_AUDIO",
  "android.permission.SYSTEM_ALERT_WINDOW",
];

const ENSURE = ["android.permission.CAMERA"];

module.exports = function withSmartServeManifest(config) {
  return withDangerousMod(config, [
    "android",
    async (config) => {
      const manifestPath = path.join(
        config.modRequest.projectRoot,
        "android",
        "app",
        "src",
        "main",
        "AndroidManifest.xml"
      );
      if (!fs.existsSync(manifestPath)) return config;

      let xml = fs.readFileSync(manifestPath, "utf8");

      // Remove permissions the app does not use.
      for (const name of REMOVE) {
        xml = xml
          .split(`<uses-permission android:name="${name}"/>`)
          .join("");
      }

      // Ensure permissions the app does use are present.
      for (const name of ENSURE) {
        const tag = `<uses-permission android:name="${name}"/>`;
        if (!xml.includes(tag)) {
          xml = xml.replace("</manifest>", `  ${tag}\n</manifest>`);
        }
      }

      fs.writeFileSync(manifestPath, xml);
      return config;
    },
  ]);
};
