# StreamDrop Web Beta Guide

Web beta is the fastest way to share StreamDrop with iOS testers before paying for Apple Developer/TestFlight.

## Local Production Build

```bash
npm run build:web
```

Expo exports the web app to `dist`.

## Recommended Hosting

Use Vercel or Netlify.

### Vercel

- Framework preset: Other
- Build command: `npm run build:web`
- Output directory: `dist`

### Netlify

- Build command: `npm run build:web`
- Publish directory: `dist`

## Beta Tester Instructions

Send testers the web URL and ask them to open it in Safari on iPhone.

Ask them to test:

- Home loads weekend releases.
- Filters are easy to tap.
- Details page is clear.
- Save/remove watchlist works.
- Watchlist item opens details.
- Settings feedback opens an email draft.

## Web Limitations

- Friday notifications are limited on web compared with a native iOS app.
- Exit app behavior is native-only.
- App icon and splash are not the same as a TestFlight build.

Use web beta to validate the product idea and UI flow. Move to TestFlight when users confirm the app is worth native beta distribution.
