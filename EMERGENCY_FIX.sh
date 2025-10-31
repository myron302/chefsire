#!/bin/bash

echo "╔══════════════════════════════════════════════════════════╗"
echo "║        EMERGENCY FIX - Complete Cache Wipe              ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

cd /home/user/chefsire

echo "1️⃣  Killing ALL Node processes..."
killall -9 node 2>/dev/null || true
sleep 2

echo "2️⃣  Removing ALL cache directories..."
find . -type d -name ".vite" -exec rm -rf {} + 2>/dev/null || true
find . -type d -name "dist" -exec rm -rf {} + 2>/dev/null || true
find . -type d -name ".cache" -exec rm -rf {} + 2>/dev/null || true
rm -rf client/.vite client/dist client/node_modules/.vite
rm -rf node_modules/.vite node_modules/.cache
rm -rf .vite

echo "3️⃣  Removing lock files..."
rm -f package-lock.json
rm -f client/package-lock.json

echo "4️⃣  Reinstalling dependencies..."
npm install

echo ""
echo "✅ Complete cache wipe and reinstall done!"
echo ""
echo "NOW RUN: npm run dev"
echo ""
echo "THEN IN BROWSER:"
echo "  1. Close ALL localhost tabs"
echo "  2. Open DevTools (F12)"
echo "  3. Right-click refresh button"
echo "  4. Click 'Empty Cache and Hard Reload'"
echo "  5. OR use Incognito/Private window"
echo ""

