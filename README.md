# StreamDrop

StreamDrop helps viewers find new OTT movie releases for the weekend, filter by language and streaming service, and save titles to a watchlist.

## MVP Beta Scope

- Weekend-first release discovery from Thursday through Sunday.
- Last 1, 3, or 6 months OTT release windows.
- Language filters for English, Hindi, Tamil, Telugu, Malayalam, and Kannada.
- Streaming filters for All, Netflix, Prime, Disney+, Hulu, Hotstar, Apple TV, and HBO Max.
- Genre filter, age-rating labels, TMDB ratings, runtime, OTT provider, and details pages.
- Watchlist with saved-title recommendations based on the last three saved movies.
- Friday reminder notifications.
- Settings for notifications, default filters, release window, TMDB credits, feedback, and exit.

## Beta Test Checklist

- Home loads releases on a fresh install.
- Language, streaming, and genre filters update release rows.
- This Weekend and recent-release empty states read clearly.
- Movie details open from home and watchlist.
- Save to Watchlist changes to Saved to Watchlist.
- Watchlist badge count updates after save and remove.
- Recommendations do not show already-saved movies.
- Friday alerts request permission and show the enabled state.
- Settings feedback opens an email draft.
- TMDB attribution is visible in Settings and footer.

## Store Copy Draft

**Short description**

Find new OTT movies for your weekend watchlist.

**Full description**

StreamDrop shows new streaming movie releases with a weekend-first view, language and OTT filters, genre filtering, ratings, age guidance, and a simple watchlist. Save movies you are interested in and get recommendations based on what you saved.

StreamDrop uses TMDB data and images but is not endorsed, certified, or otherwise approved by TMDB.

## Development

Install dependencies:

```bash
npm install
```

Start Expo:

```bash
npx expo start
```

Run checks:

```bash
npx tsc --noEmit
npm run lint
```

Build web beta:

```bash
npm run build:web
```
