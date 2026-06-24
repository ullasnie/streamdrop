# StreamDrop iPhone Beta Build Guide

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

3. Confirm the native identifier before the first beta build.

- iOS bundle id: `com.ullas.streamdrop`
- iPhone only: iPad support is disabled.

Changing the bundle ID after uploading to Apple can create extra store work, so lock it before external beta.

## TestFlight Beta Build

Create the iPhone build:

```bash
npx eas build --profile preview --platform ios
```

Submit the build to App Store Connect and TestFlight:

```bash
npx eas submit --platform ios
```

## Before Sharing

- Replace any remaining placeholder copy.
- Test feedback email from Settings.
- Test Friday notifications on a development or EAS build, not only Expo Go.
- Confirm app icon and splash screen on a real iPhone.
- Confirm TMDB attribution is visible in Settings.
- Confirm the public privacy policy loads at `https://streamdrop-eight.vercel.app/privacy`.
- Confirm the public support page is ready before store submission.
