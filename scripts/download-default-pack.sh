#!/usr/bin/env bash
# Downloads the default Twinshot sample pack for bundling with the app.
# Skipped if the file already exists (cached from a previous build).

set -euo pipefail

URL="https://www.elektron.se/product/twinshot?download=yes&product_id=18453"
DEST="public/twinshot.zip"

if [ -f "$DEST" ]; then
  echo "Default pack already downloaded: $DEST"
  exit 0
fi

echo "Downloading default pack..."
curl -fSL -o "$DEST" "$URL"
echo "Saved to $DEST"
