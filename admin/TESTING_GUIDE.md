# Testing Theme Persistence

## Quick Verification Steps

### 1. Check if Theme is Cached
Open browser console and run:
```javascript
// Get your schoolId from the session
const token = document.cookie.match(/access_token=([^;]+)/)?.[1];
const payload = JSON.parse(atob(token.split('.')[1]));
console.log('School ID:', payload.schoolId);

// Check if theme is cached
const themeKey = `school_theme_${payload.schoolId}`;
const cached = localStorage.getItem(themeKey);
console.log('Cached theme:', JSON.parse(cached));
```

### 2. Test Bootstrap Script
Add this to browser console to see if bootstrap script runs:
```javascript
// Check if CSS variables are set
const root = document.documentElement;
console.log('Navbar BG:', root.style.getPropertyValue('--theme-navbar-bg'));
console.log('Header BG:', root.style.getPropertyValue('--theme-header-bg'));
console.log('Footer BG:', root.style.getPropertyValue('--theme-footer-bg'));
console.log('Button BG:', root.style.getPropertyValue('--theme-button-bg'));
console.log('Button Text:', root.style.getPropertyValue('--theme-button-text'));
```

### 3. Test Full Flow

#### Step 1: Publish a Theme
1. Go to `/dashboard/themes`
2. Create and publish a theme with distinct colors (e.g., red navbar)
3. Open console and verify cache:
```javascript
const schoolId = 'YOUR_SCHOOL_ID'; // Replace with actual
console.log(localStorage.getItem(`school_theme_${schoolId}`));
```

#### Step 2: Test Immediate Application
1. Hard refresh the page (Cmd+Shift+R or Ctrl+Shift+R)
2. Watch carefully - you should NOT see default colors
3. Theme should be applied instantly

#### Step 3: Test Offline Mode
1. Open DevTools → Network tab
2. Set throttling to "Offline"
3. Refresh page
4. Theme should still load from cache

### 4. Debug Issues

#### If theme is not loading from cache:

**Check 1: Is theme being stored?**
```javascript
// After publishing a theme, check:
const schoolId = 'YOUR_SCHOOL_ID';
const theme = localStorage.getItem(`school_theme_${schoolId}`);
console.log('Theme stored:', theme !== null);
console.log('Theme data:', JSON.parse(theme));
```

**Check 2: Is bootstrap script running?**
```javascript
// Add this temporarily to layout.tsx script to debug:
console.log('Bootstrap script running');
console.log('Token found:', !!getCookie('access_token'));
console.log('SchoolId:', payload?.schoolId);
console.log('Theme found:', !!themeStr);
```

**Check 3: Is ThemeProvider applying cache?**
Add console.log to ThemeProvider.tsx:
```typescript
useEffect(() => {
  if (!schoolId) return;
  const stored = getStoredTheme(schoolId);
  console.log('ThemeProvider: Applying cached theme', stored);
  // ... rest of code
}, [schoolId]);
```

### 5. Expected Behavior

✅ **Correct:**
- Page loads → Theme visible immediately
- No flash of default colors
- Works offline after first load
- Different schools have different themes

❌ **Incorrect:**
- Page loads → Default colors → Then theme appears
- Flash of white/default colors
- Theme only loads after API response
- Offline mode shows default colors

### 6. Performance Test

Open DevTools → Performance tab:
1. Start recording
2. Hard refresh page
3. Stop recording
4. Look for "style recalculation" events
5. Theme CSS variables should be set BEFORE React hydration

### 7. Multi-tenant Test

If you have access to multiple schools:
1. Login to School A → Note the theme colors
2. Logout
3. Login to School B → Should see different theme
4. Check localStorage:
```javascript
// Should see both themes cached
Object.keys(localStorage)
  .filter(k => k.startsWith('school_theme_'))
  .forEach(k => console.log(k, localStorage.getItem(k)));
```

## Common Issues & Fixes

### Issue: Theme loads after API response
**Cause:** ThemeProvider not reading cache immediately
**Fix:** Already fixed in latest code - ThemeProvider now has separate useEffect for cache

### Issue: Bootstrap script not running
**Cause:** Script syntax error or cookie not found
**Fix:** Check browser console for errors, verify access_token cookie exists

### Issue: Wrong theme applied
**Cause:** SchoolId mismatch between cache key and actual schoolId
**Fix:** Clear localStorage and re-publish theme

### Issue: Theme not persisting after publish
**Cause:** publishTheme not calling storeTheme
**Fix:** Already fixed - publishTheme now auto-stores

## Manual Cache Management

### Clear all theme caches:
```javascript
Object.keys(localStorage)
  .filter(k => k.startsWith('school_theme_'))
  .forEach(k => localStorage.removeItem(k));
console.log('All theme caches cleared');
```

### Manually set a theme:
```javascript
const schoolId = 'YOUR_SCHOOL_ID';
const theme = {
  tokens: {
    navbarBg: '#ff0000',
    headerBg: '#00ff00',
    footerBg: '#0000ff',
    buttonBg: '#ffff00',
    buttonText: '#000000',
    logoUrl: ''
  }
};
localStorage.setItem(`school_theme_${schoolId}`, JSON.stringify(theme));
console.log('Theme manually set - refresh to see changes');
```
