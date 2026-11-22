# Mobile App Distribution & Site Staff Install Guide

## 1. Building Internal Distribution Packages (EAS Build)

`apps/mobile/eas.json` defines two build profiles:

- **Internal Preview (Android APK / iOS Ad-Hoc / TestFlight):**
  ```bash
  cd apps/mobile
  npx eas-cli build --profile preview --platform android
  npx eas-cli build --profile preview --platform ios
  ```
- **Production:**
  ```bash
  npx eas-cli build --profile production --platform all
  ```

## 2. Site Staff Installation Guide

1. **Install the App:**
   - **Android:** Open the internal distribution link sent by the office on your phone, download the `.apk`, and tap **Install**.
   - **iPhone:** Install **TestFlight** from the App Store and accept the Contoh Bina invite link.
2. **Sign In:**
   - Enter the email and password provided by the office. Your phone stays signed in even when you have no signal on site.
3. **Submitting Daily Reports (Online or Offline):**
   - Open your assigned project and tap **New daily report**.
   - Choose the date (today or up to 2 days back), select the weather, attach at least 1 site photo (up to 20), enter work done, and adjust manpower headcount.
   - Your draft saves automatically as you type.
   - Tap **Submit report**. If you have no signal on site, the report is queued under **Waiting to upload** and uploads automatically as soon as your phone regains connectivity.
