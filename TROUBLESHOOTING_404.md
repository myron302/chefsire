# Fixing 404 Errors for Caffeinated Pages

## Issue
All caffeinated drink pages are showing 404 errors after the espresso page update.

## Cause
The dev server needs to be restarted to pick up the changes to the espresso page (1138 lines of new code).

## Solution

### 1. Stop the Development Server
If it's running, press `Ctrl+C` in the terminal where the server is running.

### 2. Clear Build Cache (Optional but recommended)
```bash
cd /home/user/chefsire
rm -rf client/.vite client/node_modules/.vite
```

### 3. Restart the Development Server
```bash
cd /home/user/chefsire
npm run dev
```

### 4. Clear Browser Cache
- **Chrome/Edge**: Press `Ctrl+Shift+Delete` (or `Cmd+Shift+Delete` on Mac)
- Or do a hard refresh: `Ctrl+F5` (or `Cmd+Shift+R` on Mac)

### 5. Verify All Pages Work
Navigate to each caffeinated page:
- `/drinks/caffeinated/espresso` - ✅ Updated with full features
- `/drinks/caffeinated/cold-brew` - Should load (has old data)
- `/drinks/caffeinated/energy` - Should load (placeholder)
- `/drinks/caffeinated/iced` - Should load (placeholder)
- `/drinks/caffeinated/lattes` - Should load (placeholder)
- `/drinks/caffeinated/matcha` - Should load (placeholder)
- `/drinks/caffeinated/tea` - Should load (placeholder)
- `/drinks/caffeinated/specialty` - Should load (placeholder)

## Verification

All files exist and have proper exports:
```bash
$ ls -la client/src/pages/drinks/caffeinated/*/index.tsx
-rw-r--r-- 1 root root 10630 client/src/pages/drinks/caffeinated/cold-brew/index.tsx
-rw-r--r-- 1 root root   883 client/src/pages/drinks/caffeinated/energy/index.tsx
-rw-r--r-- 1 root root 49050 client/src/pages/drinks/caffeinated/espresso/index.tsx ✅ UPDATED
-rw-r--r-- 1 root root   894 client/src/pages/drinks/caffeinated/iced/index.tsx
-rw-r--r-- 1 root root   897 client/src/pages/drinks/caffeinated/lattes/index.tsx
-rw-r--r-- 1 root root   902 client/src/pages/drinks/caffeinated/matcha/index.tsx
-rw-r--r-- 1 root root   891 client/src/pages/drinks/caffeinated/specialty/index.tsx
-rw-r--r-- 1 root root   882 client/src/pages/drinks/caffeinated/tea/index.tsx
```

All imports are valid:
- ✅ RecipeKit exists
- ✅ UniversalSearch exists
- ✅ DrinksContext exists
- ✅ All UI components exist

## If Still Having Issues

1. Check the browser console for errors (F12)
2. Check the dev server terminal for error messages
3. Try accessing the caffeinated main page first: `/drinks/caffeinated`
4. Then navigate to individual pages from there

## Alternative: Quick Fix
If the above doesn't work, try:
```bash
cd /home/user/chefsire
npm install
npm run dev
```

This will reinstall dependencies and restart the server with a clean state.
