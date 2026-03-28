# Kurumsal Mobil (Android + iOS)

Bu klasor, mevcut web siteni mobil uygulama olarak calistirmak icin Expo + React Native WebView yapisini icerir.

## 1) Kurulum

```bash
cd mobile-app
npm install
```

## 2) Site adresini ayarla

`App.js` icindeki `SITE_URL` degiskenini kendi canli siten ile degistir:

```js
const SITE_URL = "https://www.tedarikci.org.tr";
```

## 3) Calistirma

```bash
npm run start
```

Ardindan:
- Android icin `a`
- iOS icin `i` (macOS + Xcode gerekir)

## 4) Android AAB build (Play Store)

Ilk kurulum:

```bash
npm install -g eas-cli
eas login
```

Bu projede `eas.json` hazir oldugu icin tek komutla Android production AAB alabilirsin:

```bash
npm run build:android
```

Test amacli internal build icin:

```bash
npm run build:preview
```

## 5) iOS notu

iOS build almak icin Apple Developer hesabi gerekir.
