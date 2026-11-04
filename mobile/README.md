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
   │  └─ (tabs)/       One folder per bottom tab: (shop), cart, track, account, biz-orders, biz-products
   ├─ core/            Shared: Supabase client, settings, cart, storage, theme, UI kit
   └─ modules/         ← Features live here (plug-and-play)
      ├─ registry.ts   The list of active modules (+ which tabs each role sees)
      ├─ search/       Home search bar with live suggestions, paginated results
      ├─ catalog/      Home, suppliers, categories, subcategories, product   (core)
      ├─ cart/         One-supplier cart, checkout (login required), confirmation (core)
      ├─ orders/       My orders (customers), track by code (guests)
      ├─ account/      Log in, sign up, profile, password, delete account     (core)
      └─ business/     Business dashboard: orders + products (business accounts only)

Roles: guest · customer · business (each sees its own tabs; set in each module's `tab.roles`).
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

**A module can also add a block to the top of the home screen** with `HomeTop` (that's how search plugs in).

**Rules for modules**
- Modules may import from `src/core/`, never from each other.
- Shared state (cart, settings) lives in `src/core/`.
- Anything that needs database changes ships as the next numbered file in `supabase/migrations/`.

## Security

- The app uses only the public (publishable) key. All access rules are enforced by the database.
- Orders are created via `place_order` (prices recalculated on the server, one supplier per order).
  Customers can read only their own orders; a business only orders placed with it; guests only via
  `lookup_order` (phone + order code, rate limited).
- Businesses can add/edit only their own products and upload photos only into their own folder.
- Accounts: phone + password (Supabase Auth). Business logins are created only by the admin.
- No analytics, no tracking. Customers can delete their account in the app.

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
