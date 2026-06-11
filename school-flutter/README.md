# School ERP Flutter

Flutter mobile app for the existing School ERP backend.

## Run

```sh
flutter pub get
flutter run --dart-define=API_BASE_URL=http://localhost:3000/api/v1
```

For Android emulator access to a host-machine backend, use:

```sh
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000/api/v1
```

## Current Scope

- Material 3 Flutter app scaffold.
- Riverpod app state and dependency injection.
- GoRouter auth-aware navigation.
- Dio API client with `x-client-platform: school-mobile`.
- Secure token persistence with `flutter_secure_storage`.
- Refresh-token retry flow for `401` responses.
- Login, email/TOTP MFA verification, dashboard, profile, and module placeholders.
- Permission-first mobile module registry using the existing backend permission codes.

The app does not expose a school selector after login. Tenant context comes from the authenticated backend response.
