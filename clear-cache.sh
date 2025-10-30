#!/bin/bash

echo "╔══════════════════════════════════════════════════════╗"
echo "║     Clearing Vite/Build Caches                      ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

cd /home/user/chefsire

echo "🗑️  Removing client/.vite..."
rm -rf client/.vite

echo "🗑️  Removing client/dist..."
rm -rf client/dist

echo "🗑️  Removing client/node_modules/.vite..."
rm -rf client/node_modules/.vite

echo "🗑️  Removing root node_modules/.vite..."
rm -rf node_modules/.vite

echo ""
echo "✅ All caches cleared!"
echo ""
echo "📝 Next steps:"
echo "   1. Restart your dev server: npm run dev"
echo "   2. Hard refresh browser: Ctrl+F5 (or Cmd+Shift+R on Mac)"
echo "   3. Or try incognito window"
echo ""
