# SAAPT Parent App

`school-parents` is the parent-only Flutter application for Akademifyy/SAAPT schools.

## Features

- Parent login with registered email and password
- Home tab with mapped children
- Attendance tab for the selected child
- Reports tab for exam results and fee status
- Alerts tab for school notices and notifications
- Firebase Cloud Messaging registration for parent push notifications

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

## API

The API base URL is configured through a Dart define:

```dart
--dart-define=API_BASE_URL=https://api.akademifyy.in/api/v1
```

If no value is provided, the app defaults to `https://api.akademifyy.in/api/v1`.

## Build

```bash
flutter pub get
flutter build apk --debug
flutter build apk --release --dart-define=API_BASE_URL=https://api.akademifyy.in/api/v1
flutter build ios --no-codesign --dart-define=API_BASE_URL=https://api.akademifyy.in/api/v1
```

## Firebase

Android uses `android/app/google-services.json`.

iOS uses `ios/Runner/GoogleService-Info.plist`.
