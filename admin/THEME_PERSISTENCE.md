# Theme Persistence Implementation

## Overview
This implementation ensures that school themes are applied immediately on page load without any flash of default colors, even after refresh.

## Architecture

### 1. Theme Service (`services/theme.service.ts`)
Provides a clean abstraction for theme management:

- **`getStoredTheme(schoolId)`**: Retrieves cached theme from localStorage
- **`storeTheme(schoolId, theme)`**: Stores theme in localStorage with school-scoped key
- **`fetchActiveTheme(schoolId)`**: Fetches from API and auto-caches
- **`applyTheme(theme)`**: Applies theme via CSS variables
- **`publishTheme(id, schoolId)`**: Auto-stores theme when admin activates it

### 2. Bootstrap Script (`app/layout.tsx`)
Inline script that runs before React hydration:
- Extracts schoolId from JWT token in cookies
- Reads cached theme from localStorage (`school_theme_{schoolId}`)
- Applies CSS variables immediately
- Prevents any default color flash

### 3. ThemeProvider (`components/ThemeProvider.tsx`)
React component that:
- Reads cached theme on mount
- Applies it immediately
- Fetches active theme from API in background
- Updates cache if API returns different theme
- Falls back to cached theme on API failure

## Flow

### Initial Load
1. Bootstrap script applies cached theme (0ms delay)
2. React app initializes
3. ThemeProvider mounts and confirms theme
4. API call syncs in background
5. If theme changed, updates cache and re-applies

### Page Refresh
1. Bootstrap script applies cached theme immediately
2. No flash of default colors
3. Background sync ensures latest theme

### Admin Theme Activation
1. Admin publishes new theme
2. `publishTheme()` stores it immediately in localStorage
3. Theme applied instantly
4. All users get it on next page load

## Storage Key Format
```
school_theme_{schoolId}
```

Example:
```
school_theme_abc123 = {
  "tokens": {
    "navbarBg": "#0f172a",
    "headerBg": "#111827",
    "footerBg": "#0f172a",
    "buttonBg": "#2563eb",
    "buttonText": "#ffffff",
    "logoUrl": "https://..."
  }
}
```

## CSS Variables Applied
- `--theme-navbar-bg`
- `--theme-header-bg`
- `--theme-footer-bg`
- `--theme-button-bg`
- `--theme-button-text`

## Error Handling
- localStorage failures are silently ignored
- API failures fall back to cached theme
- Invalid JSON is caught and ignored
- Missing schoolId gracefully skips theme application

## Production Safety
- No breaking changes to existing architecture
- Backward compatible with existing themes
- Graceful degradation if localStorage unavailable
- No impact on users without cached themes
