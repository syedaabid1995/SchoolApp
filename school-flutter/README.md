# Mobile App README

## Mobile App Overview

`school-flutter` is the Flutter staff mobile application for the School ERP platform. It is built around Riverpod, GoRouter, Dio, Hive, secure storage, Firebase Messaging, local notifications, connectivity detection, offline cache, sync helpers, and permission-driven navigation.

## Technology Stack

| Area | Implementation |
| --- | --- |
| Framework | Flutter |
| Language | Dart |
| State management | Riverpod |
| Routing | GoRouter |
| HTTP | Dio |
| Secure storage | `flutter_secure_storage` |
| Local cache | Hive / Hive Flutter |
| Push notifications | Firebase Messaging, Flutter local notifications |
| Connectivity | `connectivity_plus` |
| Images | `cached_network_image` |
| Localization | `flutter_localizations`, `intl` |
| App metadata | `package_info_plus` |

## Architecture Pattern

Feature folders use a clean architecture style:

```text
features/<feature>/
├── data/           # datasources, models, repository implementations
├── domain/         # entities and repository contracts
└── presentation/   # providers, screens, widgets
```

Shared infrastructure lives under `lib/core`:

```text
core/
├── analytics/
├── cache/
├── connectivity/
├── constants/
├── errors/
├── localization/
├── network/
├── pagination/
├── permissions/
├── services/
├── storage/
├── sync/
├── utils/
└── widgets/
```

## Folder Structure

```text
school-flutter/
├── android/
├── ios/
├── lib/
│   ├── app/
│   ├── core/
│   ├── features/
│   └── shared/
├── test/
├── web/
└── pubspec.yaml
```

## Features

Feature folders discovered:

| Feature | Status in codebase |
| --- | --- |
| Auth | Implemented |
| Dashboard | Implemented |
| Staff self attendance | Implemented |
| Student attendance | Implemented |
| Timetable | Implemented |
| Notifications | Implemented |
| Notices/communication | Implemented |
| Profile | Implemented |
| Settings/diagnostics | Implemented |
| Leave | Implemented |
| Homework | Implemented |
| Classes | Implemented |
| Exams | Implemented |
| Marks | Implemented |
| Academic | Implemented |

Routes discovered in `lib/app/routes/app_routes.dart` include dashboard, attendance, student attendance, timetable, notifications, profile, settings, diagnostics, fees, reports, homework, leave, notices, classes, exams, marks, library, transport, payroll, and HR.

## Authentication

Auth uses backend endpoints:

- `/auth/login`
- `/auth/refresh`
- `/auth/logout`
- `/users/me`
- `/auth/change-password`
- `/auth/forgot-password`
- `/auth/verify-2fa`
- `/auth/resend-2fa`

Tokens are handled through the networking/auth storage layer; sensitive tokens must not be cached in Hive.

## Permissions

The mobile app includes `core/permissions` with a permission checker and registry. Drawer/menu visibility and route access are permission-driven using permissions returned by `/users/me`.

## Notifications

The app includes Firebase Messaging, local notifications, notification repository/data/domain/presentation modules, unread count support, and local persistence through Hive where implemented.

## API Integration

The API base URL is defined in `lib/core/constants/app_config.dart`:

```dart
static const apiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'https://schoolapp-6a6f.onrender.com/api/v1',
);
```

Configured endpoints are in `lib/core/constants/api_endpoints.dart`, including auth, users, timetable, attendance, notifications, leave, homework, classes, exams, and marks.

## Local Storage

Local persistence uses Hive and Flutter secure storage. Cache/sync infrastructure exists under `lib/core/cache`, `lib/core/storage`, and `lib/core/sync`.

## Build Android

```bash
cd school-flutter
flutter pub get
flutter build apk --debug --dart-define=API_BASE_URL=http://127.0.0.1:4000/api/v1
flutter build apk --release --dart-define=API_BASE_URL=https://example.com/api/v1
```

## Build iOS

```bash
cd school-flutter
flutter pub get
flutter build ios --no-codesign --dart-define=API_BASE_URL=https://example.com/api/v1
```

## Build Web

```bash
cd school-flutter
flutter build web --debug --dart-define=API_BASE_URL=http://127.0.0.1:4000/api/v1
```

## Environment Variables

Flutter uses Dart defines rather than a checked-in `.env` file.

| Dart define | Purpose |
| --- | --- |
| `API_BASE_URL` | Backend API base URL |

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Login fails | Verify `API_BASE_URL`, school ID, backend `/auth/login`, and tenant context |
| Menu item visible incorrectly | Verify `/users/me` permissions and `core/permissions/permission_registry.dart` |
| Attendance data missing | Verify backend attendance permissions and canonical attendance endpoints |
| Timetable data missing | Verify modern timetable data, published/draft version behavior, and teacher assignment |
| Offline data stale | Check Hive cache and sync status |
