#!/bin/bash

echo "╔══════════════════════════════════════════════════════════╗"
echo "║     Complete Dev Server Restart Script                  ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

cd /home/user/chefsire

echo "Step 1: Killing any existing dev servers..."
pkill -f "vite" 2>/dev/null || true
pkill -f "npm run dev" 2>/dev/null || true
sleep 2

echo "Step 2: Clearing all build caches..."
rm -rf client/.vite
rm -rf client/dist
rm -rf client/node_modules/.vite
rm -rf node_modules/.vite
rm -rf .vite

echo "Step 3: Clearing node modules cache..."
rm -rf node_modules/.cache

echo ""
echo "✅ All processes killed and caches cleared!"
echo ""
echo "📝 Now run this to start the dev server:"
echo "   cd /home/user/chefsire"
echo "   npm run dev"
echo ""
echo "🌐 Then in your browser:"
echo "   1. Close ALL tabs with localhost:5173"
echo "   2. Clear browser cache (Ctrl+Shift+Delete)"
echo "   3. Open NEW tab with http://localhost:5173"
echo "   4. Navigate to /drinks/caffeinated/espresso"
echo ""
