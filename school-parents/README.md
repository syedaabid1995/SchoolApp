# Parent App (SAAPT / Akademifyy flavors)

`school-parents` is the parent-only Flutter application. One codebase builds two branded apps.

## Features

- Parent login with registered email and password
- Home tab with mapped children
- Attendance tab for the selected child
- Reports tab for exam results and fee status
- Alerts tab for school notices and notifications
- Fees / online payment
- Firebase Cloud Messaging registration for parent push notifications

## Brand flavors (Android)

| Flavor | Package ID | API | App name |
| --- | --- | --- | --- |
| `saapt` | `com.saapt.parent` | `https://api.saapttech.com/api/v1` | SAAPT Parent |
| `akademifyy` | `com.akademifyy.parent` | `https://api.akademifyy.in/api/v1` | Akademifyy Parent |

```bash
# From repo root (recommended)
./scripts/build-flavor-apk.sh parent saapt
./scripts/build-flavor-apk.sh parent akademifyy

# Or manually
cd school-parents
flutter pub get
flutter build apk --flavor saapt --dart-define-from-file=flavors/saapt.json
flutter build apk --flavor akademifyy --dart-define-from-file=flavors/akademifyy.json

flutter run --flavor saapt --dart-define-from-file=flavors/saapt.json
flutter run --flavor akademifyy --dart-define-from-file=flavors/akademifyy.json
```

Replace logos under `assets/branding/` and launcher icons under `android/app/src/<flavor>/res/mipmap-*`.

## App Structure

```text
lib/
├── main.dart
└── saapt_ui/
    ├── app/
    ├── core/
    └── features/
        ├── auth/
        └── parent/
```

## API / Dart defines

| Dart define | Purpose |
| --- | --- |
| `APP_BRAND` | `saapt` or `akademifyy` |
| `API_BASE_URL` | Backend API base URL |

Defaults (if defines omitted): SAAPT API host. Prefer `flavors/*.json`.

## Firebase

Android uses `android/app/google-services.json` (includes `com.saapt.parent` and `com.akademifyy.parent`).

iOS uses `ios/Runner/GoogleService-Info.plist`.
