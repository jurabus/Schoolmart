# SchoolMart mobile app

iPhone + Android app for SchoolMart, built with **Expo SDK 58** (React Native + Expo Router).
It uses the **same Supabase database** as the website, so products, prices, texts and orders are shared.
Manage everything from **www.schoolmart.pro/admin** — the app updates automatically.

## Structure

```
mobile/
├─ app.json            App name, icons, bundle IDs (pro.schoolmart.app)
├─ eas.json            Cloud build profiles (preview = Android test APK, production = store builds)
├─ assets/             Icon, Android adaptive icon, splash
└─ src/
   ├─ app/             Routes only (thin files that point to module screens)
   │  └─ (tabs)/       One folder per bottom tab: (shop), cart, track
   ├─ core/            Shared: Supabase client, settings, cart, storage, theme, UI kit
   └─ modules/         ← Features live here (plug-and-play)
      ├─ registry.ts   The list of active modules
      ├─ catalog/      Home, categories, subcategories, product  (core)
      ├─ cart/         Cart, checkout, confirmation               (core)
      └─ orders/       Order tracking + recent orders on this device
```

## Plug-and-play modules

Every feature is a module in `src/modules/<id>/` with an `index.ts` that exports an `AppModule`:

```ts
export const wishlistModule: AppModule = {
  id: 'wishlist',
  tab: { route: 'wishlist', title: S => 'Wishlist', icon: 'heart-outline', order: 25 },
};
```

**Add a module**
1. Create `src/modules/<id>/` with its screens and `index.ts`.
2. If it has a tab, add `src/app/(tabs)/<route>/_layout.tsx` + `index.tsx` (one-line re-exports, like the others).
3. Add it to `MODULES` in `src/modules/registry.ts`.

**Remove a module:** delete it from `MODULES` and delete its route folder.

**Switch a module off without an app update:** add a setting `app_disabled_modules`
(comma separated ids, e.g. `orders`) to the website settings. Core modules can't be switched off.

**Rules for modules**
- Modules may import from `src/core/`, never from each other.
- Shared state (cart, settings) lives in `src/core/`.
- Anything that needs new database tables ships with its own SQL file in `supabase/modules/<id>.sql`.

## Security

- The app uses only the public (publishable) key. All access rules are enforced by the database.
- Orders are created via `place_order` (prices recalculated on the server) and looked up via
  `lookup_order` (phone + order code, rate limited). The app cannot list or read other orders.
- No accounts, no analytics, no tracking.

## Building (no computer needed)

Builds run in Expo's cloud from this GitHub repo (base directory: `mobile`).

| Profile | Output | Use |
|---|---|---|
| `preview` | Android `.apk` | Install directly on Android phones for testing |
| `production` | iOS `.ipa` / Android `.aab` | Upload to TestFlight / App Store and Google Play |

Version numbers (build number / versionCode) are managed remotely and auto-increment on each production build.
To release a new visible version, bump `"version"` in `app.json`.

## Commands (for development on a computer, optional)

```bash
npm install
npx expo start         # run in Expo Go / simulator
npx tsc --noEmit       # typecheck
npx expo export --platform ios --platform android   # verify bundles compile
```
