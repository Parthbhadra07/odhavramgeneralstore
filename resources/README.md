# Native app assets

Place a **1024×1024** PNG at `resources/icon.png` (store logo).

Then generate splash screens and platform icons:

```bash
npm run cap:assets
```

This updates `android/` and `ios/` launcher icons and splash screens.
