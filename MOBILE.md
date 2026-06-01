# Odhavram General Store — Mobile App (Capacitor)

Native Android and iOS apps bundle the **local static build** from the `out/` folder. They do **not** load your Vercel URL in production.

---

## 1. Package installation

```bash
npm install
```

Capacitor packages (already in `package.json`):

| Package | Purpose |
|---------|---------|
| `@capacitor/core` | Runtime |
| `@capacitor/cli` | CLI |
| `@capacitor/android` / `@capacitor/ios` | Platforms |
| `@capacitor/app` | Back button, app state |
| `@capacitor/splash-screen` | Splash |
| `@capacitor/status-bar` | Status bar styling |
| `@capacitor/push-notifications` | Push (FCM / APNs) |
| `@capacitor/network` | Online / offline |
| `cross-env` | Windows-friendly build scripts |

---

## 2. Configuration files

| File | Role |
|------|------|
| `capacitor.config.ts` | App ID `com.odhavram.generalstore`, name **Odhavram General Store**, `webDir: out` |
| `next.config.ts` | `CAPACITOR_BUILD=1` → `output: 'export'`, unoptimized images, PWA caching |
| `.env.local` | Supabase keys (required for catalog/checkout) |

**Production native app:** no `CAPACITOR_SERVER_URL` — bundled files only.

**Dev live reload (optional):**

```bash
# Terminal 1
npm run dev

# Terminal 2 — point device to your PC IP
set CAPACITOR_DEV=1
set CAPACITOR_SERVER_URL=http://192.168.1.10:3000
npx cap run android
```

---

## 3. Build static web bundle

```bash
npm run build:mobile
```

Output: `out/` (HTML, JS, CSS, service worker, manifest).

**Web deploy (Vercel)** still uses:

```bash
npm run build
```

(no static export — SSR where applicable).

---

## 4. PWA & offline

| Feature | Implementation |
|---------|----------------|
| Service worker | `@ducanh2912/next-pwa` → `public/sw.js` copied to `out/` |
| App shell cache | Workbox `NetworkFirst` for documents |
| Product catalog | Workbox `NetworkFirst` for `*.supabase.co` |
| Images | Workbox `CacheFirst` for images |
| Offline page | `/offline` |
| Cached products | `localStorage` via `src/lib/offline/product-cache.ts` |

After one online visit to **Products**, users can browse cached items offline.

---

## 5. Android setup

### Prerequisites

- [Android Studio](https://developer.android.com/studio) with **AGP 8.5.1** support
- JDK 17+ (Android Studio embedded JDK recommended)
- Node 20+

### Gradle / AGP versions (pinned)

| Component | Version |
|-----------|---------|
| Android Gradle Plugin | **8.5.1** |
| Gradle wrapper | **8.7** |

After `npm install` or `npx cap sync`, run:

```bash
npm run patch:android-agp
```

(`cap:sync` runs this automatically.)

### First-time platform add

```bash
npm run build:mobile
npx cap add android
npm run cap:sync
```

### Open & run

```bash
npm run cap:open:android
```

In Android Studio: **Run** on device or emulator.

### Release APK / AAB

1. **Build → Generate Signed Bundle / APK**
2. Use your keystore (keep backup safe)
3. Prefer **Android App Bundle (.aab)** for Play Store

### Push (FCM)

1. Firebase project → add Android app `com.odhavram.generalstore`
2. Download `google-services.json` → `android/app/`
3. Configure FCM in Firebase Console
4. Send device token from app logs to your backend (see `capacitor-mobile-provider.tsx`)

### Icons & splash

```bash
# Add resources/icon.png (1024×1024) first
npm run cap:assets
npm run cap:sync
```

---

## 6. iOS setup

### Prerequisites

- macOS with Xcode 15+
- Apple Developer account (for device / App Store)
- CocoaPods (`sudo gem install cocoapods`)

### First-time platform add

```bash
npm run build:mobile
npx cap add ios
cd ios/App && pod install && cd ../../..
npm run cap:sync
```

### Open & run

```bash
npm run cap:open:ios
```

Select team signing → Run on simulator or device.

### Push (APNs)

1. Apple Developer → Keys → Apple Push Notifications
2. Xcode → Signing & Capabilities → **Push Notifications**
3. Upload APNs key to your push provider or Firebase

### Icons & splash

Same as Android: `npm run cap:assets` then `cap sync`.

---

## 7. Mobile features

| Feature | Status |
|---------|--------|
| Bundled web (no Vercel URL) | ✅ `webDir: out` |
| Splash screen | ✅ `@capacitor/splash-screen` |
| App icons | ✅ via `@capacitor/assets` |
| Push notifications | ✅ registration; wire token to backend |
| Android back button | ✅ `App.addListener('backButton')` |
| Pull to refresh | ✅ pull down at top of page |
| Offline catalog | ✅ PWA + localStorage cache |

---

## 8. Play Store preparation checklist

- [ ] Google Play Developer account ($25 one-time)
- [ ] App name: **Odhavram General Store**
- [ ] Package: `com.odhavram.generalstore`
- [ ] Signed **AAB** (not debug APK)
- [ ] App icon 512×512, feature graphic 1024×500
- [ ] Screenshots (phone + optional tablet)
- [ ] Short & full description (grocery, Odhav, delivery)
- [ ] Privacy policy URL (required — host on site or GitHub Pages)
- [ ] Content rating questionnaire
- [ ] Target audience / data safety (declare Supabase auth, orders, phone)
- [ ] `google-services.json` for push if using FCM
- [ ] Test on real devices (checkout, admin if needed)

---

## 9. App Store preparation checklist

- [ ] Apple Developer Program ($99/year)
- [ ] Bundle ID: `com.odhavram.generalstore`
- [ ] Xcode archive → **Distribute App** → App Store Connect
- [ ] App Store Connect: name, subtitle, description, keywords
- [ ] Screenshots per device size (6.7", 6.5", iPad if supported)
- [ ] Privacy policy URL
- [ ] App Privacy labels (data linked to user: email, orders, address)
- [ ] Push Notifications capability if using alerts
- [ ] TestFlight internal test before public release
- [ ] Review notes: explain COD / QR payment, no in-app purchase for physical goods

---

## 10. Useful commands

```bash
npm run build:mobile      # Static export → out/
npm run cap:sync            # Build + copy to native projects
npm run cap:open:android    # Android Studio
npm run cap:open:ios        # Xcode
npm run cap:assets          # Generate icons/splash from resources/icon.png
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| White screen in app | Run `npm run cap:sync` after `build:mobile` |
| Supabase errors | Set env vars; native app uses same `.env` at build time |
| Push not working | Expected on emulator; use real device + FCM/APNs setup |
| `out` folder missing | Run `npm run build:mobile` first |
| Windows EPERM on `.next` | Close dev server, delete `.next`, rebuild |

---

## Architecture note

Dynamic routes use query URLs for static export compatibility:

- Product: `/products/view?slug=...`
- Order detail: `/dashboard/orders/view?id=...`
- Admin order: `/admin/orders/view?id=...`
- Invoice: `/orders/invoice?id=...`

This ensures every screen exists as a static HTML file inside the APK/IPA.
