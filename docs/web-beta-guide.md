# StreamDrop Vercel Infrastructure Guide

StreamDrop is an iPhone-only product. The Vercel deployment exists to host the
TMDB proxy and public App Store support pages. The web build is not a supported
consumer version of StreamDrop.

## Local Production Build

```bash
npm run build:web
```

Expo exports the web app to `dist`.

## Hosting

Use the existing Vercel project.

- Framework preset: Other
- Build command: `npm run build:web`
- Output directory: `dist`
- The project includes `vercel.json`, so Vercel reads these settings automatically.
- Public privacy policy: `https://streamdrop-eight.vercel.app/privacy`
- Public support page: `https://streamdrop-eight.vercel.app/support`
- TMDB proxy: `https://streamdrop-eight.vercel.app/api/tmdb`

Do not advertise the Vercel root URL as a web app. Product testing should happen
through an iPhone development build or TestFlight.
