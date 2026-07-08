# StreamDrop App Store Submission Checklist

Use this after the external TestFlight beta has enough feedback and the app is
ready for public App Store review.

## 1. Confirm the final build

- Build: `1.0.0 (6)` unless a new build is created after beta feedback.
- Platform: iPhone only.
- TestFlight status: External testing approved.
- Before submission, install the same build from TestFlight on a real iPhone and
  verify:
  - Home loads recent/weekend releases.
  - Filters work and stay in sync with Settings.
  - Search returns movie results.
  - Movie details open and Save to Watchlist works.
  - Watchlist persists after closing/reopening the app.
  - Settings opens Privacy, Support, Feedback, and TMDB credit links.
  - Friday alert permission flow behaves normally.
  - Analytics opt-out can be turned off.

## 2. App Information

- Name: choose the final App Store listing name.
  - Preferred if available: `StreamDrop`
  - If unavailable: `StreamDrop: Movie Releases`
  - Other safe options: `StreamDrop Movies`, `StreamDrop Weekend Movies`
- Subtitle: `Find New Streaming Movies`
- Category: `Entertainment`
- Secondary category: `Lifestyle`
- Content Rights: confirm that StreamDrop has rights to use app content. TMDB
  data is used through the TMDB API and attribution is included in the app.
- Age Rating: complete using the answers in `docs/app-store-metadata.md`.

## 3. Pricing and Availability

- Price: Free.
- Availability: United States first is simplest for MVP.
- Release method: Manual release after approval.
- iPhone only.
- Disable Apple silicon Mac availability for MVP unless tested.
- Disable Apple Vision Pro availability for MVP unless tested.

## 4. URLs

- Privacy Policy URL: `https://streamdrop-eight.vercel.app/privacy`
- Support URL: `https://streamdrop-eight.vercel.app/support`
- Marketing URL: leave blank for MVP.

## 5. App Store Listing Copy

### Promotional Text

```text
Discover recent streaming movie releases, see where they are available, save a watchlist, and get a Friday reminder for fresh weekend picks.
```

### Description

```text
StreamDrop helps you find a movie for the weekend without scrolling through every streaming app.

Explore recent streaming releases, narrow the list by language, service, genre, and release window, then save interesting movies to your watchlist.

Features:

- See a curated view of recent and weekend streaming releases.
- Filter by language, streaming service, genre, and release window.
- Search for movies and view available streaming providers.
- Check release information, genres, ratings, runtime, and a short overview.
- Save movies to a watchlist stored on your iPhone.
- Enable an optional Friday reminder for fresh weekend picks.
- Share quick, anonymous feedback directly in the app.

Movie data and images are provided by TMDB and used with attribution. Streaming availability and release information may vary by country and may not include every matching title.

This product uses the TMDB API but is not endorsed or certified by TMDB.
```

### Keywords

```text
streaming,movies,watchlist,OTT,releases,weekend,film,cinema,discover,providers
```

### Version 1.0 Release Notes

```text
Welcome to StreamDrop.

- Discover recent streaming movie releases.
- Filter by language, streaming service, genre, and release window.
- Search for movies and see where they are available.
- Save a personal watchlist on your iPhone.
- Enable optional Friday drop alerts.
```

## 6. Screenshots

Use the plan in `docs/store-screenshot-plan.md`.

Recommended final set:

1. Home / weekend discovery
2. Filters
3. Movie details
4. Watchlist
5. Search
6. Settings / Friday alerts

Do not show placeholder content, debug UI, empty lists, personal email addresses,
or claims like “every movie” / “all services”.

## 7. App Privacy

Recommended questionnaire summary:

- Tracking: No.
- Data linked to the user: None.
- Data not linked to the user: Product Interaction under Analytics.
- Data used for analytics only.
- No advertising data.
- No precise location.
- No contact info collected automatically.
- No search text, movie title, email address, device identifier, or advertising
  identifier sent by the app.

Important note: support emails are voluntary and happen outside automatic app
collection.

## 8. Export Compliance

- Uses standard HTTPS only.
- `ITSAppUsesNonExemptEncryption = false` is already set in `app.json`.
- If App Store Connect asks whether the app uses encryption, answer based on
  Apple's wording for standard HTTPS/non-exempt encryption.

## 9. App Review Information

### Contact

- Email: `streamdrop.26@gmail.com`
- Phone: add the account holder's reachable phone number in App Store Connect.

### Sign-in

No sign-in is required.

### Review Notes

```text
StreamDrop is an iPhone-only movie discovery app. No login is required.

Suggested review path:

1. Open Home to view recent and weekend releases.
2. Change the Language, Streaming, or Genre filters.
3. Search for a movie using the search field.
4. Open a movie and tap Save to Watchlist.
5. Open Watchlist to confirm the movie was saved locally.
6. Open Settings to review Friday alerts, anonymous usage-count controls, support, privacy, beta feedback, and TMDB credits.

Friday alerts use local iOS notifications. Movie data, images, release information, and provider information come from TMDB through a StreamDrop server hosted on Vercel.

The app does not include purchases, subscriptions, advertising, user accounts, or cross-app tracking.
```

## 10. Final submit order

1. Review external beta feedback.
2. Decide whether build `1.0.0 (6)` is final or create a new build.
3. Pick final App Store name.
4. Capture screenshots from the final build.
5. Complete App Information, Pricing, Privacy, Age Rating, and Review Notes.
6. Attach the final build.
7. Submit for App Review.
8. If approved, manually release when ready.
