# StreamDrop Beta Build Guide

## One-Time Setup

1. Install or authenticate Expo/EAS.

```bash
npx expo login
npx eas login
```

2. Initialize the EAS project if it has not been connected yet.

```bash
npx eas init
```

3. Confirm native identifiers before the first beta build.

- iOS bundle id: `com.ullas.streamdrop`
- Android package: `com.ullas.streamdrop`

Changing these after uploading to Apple or Google can create extra store work, so lock them before external beta.

## Internal Beta Builds

Android APK for direct install:

```bash
npx eas build --profile preview --platform android
```

iOS internal/TestFlight build:

```bash
npx eas build --profile preview --platform ios
```

Build both platforms:

```bash
npx eas build --profile preview --platform all
```

## Before Sharing

- Replace any remaining placeholder copy.
- Test feedback email from Settings.
- Test Friday notifications on a development or EAS build, not only Expo Go.
- Confirm app icon and splash screen on a real device.
- Confirm TMDB attribution is visible in Settings.
- Review `docs/privacy-policy-draft.md` and host the final policy URL before store submission.
