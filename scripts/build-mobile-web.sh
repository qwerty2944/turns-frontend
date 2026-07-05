#!/usr/bin/env bash
# Build the Next.js static export that ships inside the Flutter app's WebView
# and pack it as mobile/assets/web.zip.
#
#   ./scripts/build-mobile-web.sh                      # production backend
#   BACKEND=http://192.168.0.10:2567 ./scripts/build-mobile-web.sh   # local dev backend
set -euo pipefail

cd "$(dirname "$0")/.."

BACKEND="${BACKEND:-https://kr-icn-41b6e883.colyseus.cloud}"
WS_BACKEND="${WS_BACKEND:-$(echo "$BACKEND" | sed -e 's/^https:/wss:/' -e 's/^http:/ws:/')}"
OUT_ZIP="../mobile/assets/web.zip"

echo "building static export → backend=$BACKEND ws=$WS_BACKEND"
rm -rf out
NEXT_EXPORT=1 \
NEXT_PUBLIC_BACKEND_URL="$BACKEND" \
NEXT_PUBLIC_COLYSEUS_URL="$WS_BACKEND" \
npx next build

test -f out/play/index.html || { echo "ERROR: out/play/index.html missing"; exit 1; }

mkdir -p "$(dirname "$OUT_ZIP")"
rm -f "$OUT_ZIP"
(cd out && zip -qr "../$OUT_ZIP" .)
echo "wrote $(cd "$(dirname "$OUT_ZIP")" && pwd)/$(basename "$OUT_ZIP") ($(du -h "$OUT_ZIP" | cut -f1))"
