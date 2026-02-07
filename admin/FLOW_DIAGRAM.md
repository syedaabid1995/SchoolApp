# Theme Persistence Flow Diagram

## 🔄 Complete Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER VISITS PAGE                         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  STEP 1: Bootstrap Script (Inline in <head>)                    │
│  ─────────────────────────────────────────────────────────────  │
│  • Runs BEFORE React hydration                                  │
│  • Reads JWT token from cookies                                 │
│  • Extracts schoolId from token payload                         │
│  • Reads localStorage['school_theme_{schoolId}']                │
│  • Applies CSS variables to document.documentElement            │
│  • Time: ~1-2ms                                                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  RESULT: Theme Applied Instantly                                │
│  • No flash of default colors                                   │
│  • User sees branded theme immediately                          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  STEP 2: React App Initializes                                  │
│  ─────────────────────────────────────────────────────────────  │
│  • QueryProvider mounts                                         │
│  • ThemeProvider mounts                                         │
│  • Reads cached theme from localStorage                         │
│  • Confirms theme is already applied                            │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  STEP 3: Background API Sync                                    │
│  ─────────────────────────────────────────────────────────────  │
│  • fetchActiveTheme(schoolId) called                            │
│  • GET /api/proxy/themes/active?schoolId={schoolId}             │
│  • Response received                                            │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                    ┌─────────┴─────────┐
                    │                   │
                    ↓                   ↓
        ┌───────────────────┐  ┌───────────────────┐
        │  Theme Changed?   │  │  Theme Same?      │
        │  ─────────────    │  │  ───────────      │
        │  • Update cache   │  │  • No action      │
        │  • Re-apply theme │  │  • Cache valid    │
        └───────────────────┘  └───────────────────┘
```

## 🎨 Admin Publishes New Theme

```
┌─────────────────────────────────────────────────────────────────┐
│  ADMIN: Clicks "Publish" Button                                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  publishTheme(themeId, schoolId)                                │
│  ─────────────────────────────────────────────────────────────  │
│  • POST /api/proxy/themes/{id}/publish                          │
│  • Server activates theme                                       │
│  • Returns theme data                                           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  storeTheme(schoolId, theme) - AUTO CALLED                      │
│  ─────────────────────────────────────────────────────────────  │
│  • localStorage['school_theme_{schoolId}'] = JSON.stringify()   │
│  • Theme cached immediately                                     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  applyTheme(theme)                                              │
│  ─────────────────────────────────────────────────────────────  │
│  • CSS variables updated                                        │
│  • UI reflects new theme instantly                              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  ALL USERS: Next page load uses cached theme                    │
│  • No API call needed for initial render                        │
│  • Instant theme application                                    │
└─────────────────────────────────────────────────────────────────┘
```

## 🔐 Multi-Tenant Isolation

```
┌──────────────────────────────────────────────────────────────────┐
│  localStorage Structure                                          │
│  ──────────────────────────────────────────────────────────────  │
│                                                                  │
│  school_theme_abc123 → { tokens: { navbarBg: "#1e293b", ... } } │
│  school_theme_def456 → { tokens: { navbarBg: "#7c3aed", ... } } │
│  school_theme_ghi789 → { tokens: { navbarBg: "#dc2626", ... } } │
│                                                                  │
│  Each school has isolated theme cache                           │
└──────────────────────────────────────────────────────────────────┘

User switches schools:
  1. JWT token updated with new schoolId
  2. Bootstrap script reads new school's theme
  3. Different theme applied automatically
  4. No cross-contamination
```

## 🚨 Error Handling Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  Scenario: API Fails                                            │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  • Bootstrap script applies cached theme ✓                      │
│  • ThemeProvider reads cached theme ✓                           │
│  • fetchActiveTheme() fails → returns null                      │
│  • Cached theme remains active ✓                                │
│  • User sees last known theme                                   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  Scenario: No Cached Theme (First Visit)                        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  • Bootstrap script finds no cache → skips                      │
│  • ThemeProvider applies default tokens                         │
│  • fetchActiveTheme() succeeds → caches theme                   │
│  • Next visit: cached theme applied instantly                   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  Scenario: localStorage Unavailable                             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  • All storage operations silently fail                         │
│  • Falls back to API-only mode                                  │
│  • Theme fetched on every page load                             │
│  • Still functional, just no caching                            │
└─────────────────────────────────────────────────────────────────┘
```

## ⚡ Performance Comparison

### Before (Without Caching)
```
Page Load Timeline:
├─ 0ms:    HTML received
├─ 50ms:   React hydration starts
├─ 100ms:  ThemeProvider mounts
├─ 150ms:  API call initiated
├─ 350ms:  API response received  ← FLASH VISIBLE HERE
├─ 360ms:  Theme applied
└─ 400ms:  Page fully rendered

User Experience: 350ms of default colors
```

### After (With Caching)
```
Page Load Timeline:
├─ 0ms:    HTML received
├─ 2ms:    Bootstrap script applies cached theme ← INSTANT
├─ 50ms:   React hydration starts
├─ 100ms:  ThemeProvider mounts (theme already applied)
├─ 150ms:  Background API sync (non-blocking)
├─ 350ms:  API response (validates cache)
└─ 400ms:  Page fully rendered

User Experience: 0ms flash, instant theme
```

## 🎯 Key Takeaways

1. **Bootstrap script is critical** - Runs before React, prevents flash
2. **School-scoped keys** - Multi-tenant isolation guaranteed
3. **Auto-caching on publish** - Admin changes propagate automatically
4. **Graceful degradation** - Works without cache, without API
5. **Zero breaking changes** - Existing code continues to work
