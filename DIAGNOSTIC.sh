#!/bin/bash
set -e

echo "╔══════════════════════════════════════════════════════════╗"
echo "║     COMPLETE DIAGNOSTIC & FIX SCRIPT                     ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

cd /home/user/chefsire

echo "1️⃣  Checking file existence..."
for page in espresso cold-brew energy iced lattes matcha tea specialty; do
  file="client/src/pages/drinks/caffeinated/$page/index.tsx"
  if [ -f "$file" ]; then
    echo "  ✅ $page exists"
  else
    echo "  ❌ $page MISSING"
  fi
done

echo ""
echo "2️⃣  Checking export statements..."
grep -h "export default" client/src/pages/drinks/caffeinated/*/index.tsx

echo ""
echo "3️⃣  Checking App.tsx imports..."
grep "caffeinated" client/src/App.tsx | grep -E "(import|Route)" | head -10

echo ""
echo "4️⃣  Killing dev server..."
killall -9 node 2>/dev/null || true
sleep 2

echo ""
echo "5️⃣  Clearing ALL caches..."
rm -rf client/.vite client/dist client/node_modules/.vite node_modules/.vite .vite
rm -rf node_modules/.cache client/node_modules/.cache

echo ""
echo "6️⃣  Checking for stale bundle files..."
if [ -d "client/dist" ]; then
  echo "  ⚠️  Found client/dist - removing..."
  rm -rf client/dist
fi

echo ""
echo "✅ Diagnostic complete!"
echo ""
echo "📋 WHAT TO DO NEXT:"
echo "   1. Run: npm run dev"
echo "   2. Wait for server to fully start"
echo "   3. In browser:"
echo "      - Close ALL localhost tabs"
echo "      - Open DevTools (F12)"
echo "      - Go to Network tab"
echo "      - Check 'Disable cache'"
echo "      - Navigate to http://localhost:5173/drinks/caffeinated/espresso"
echo "   4. Check console for errors"
echo ""
echo "If still 404:"
echo "   - Try incognito window"
echo "   - Check that bundle hash changes (not index-YHrXPd0h.js)"
echo "   - If same hash, server needs hard restart"
echo ""
