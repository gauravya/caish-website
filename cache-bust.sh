#!/bin/bash
#
# cache-bust.sh — Automatically update CSS/JS cache-busting versions
#
# Uses content hashing so versions only change when files actually change.
# Run this after editing styles.css or enhancements.js.
#
# Usage:  ./cache-bust.sh
#

set -euo pipefail
cd "$(dirname "$0")"

# Generate short content hashes (first 8 chars of md5)
CSS_HASH=$(md5sum styles.css | cut -c1-8)
JS_HASH=$(md5sum enhancements.js | cut -c1-8)

echo "styles.css    hash: $CSS_HASH"
echo "enhancements.js hash: $JS_HASH"

# Files that reference styles.css and enhancements.js
HTML_FILES=(index.html about.html fellowship.html events.html mars.html desk.html research.html)

# Update CSS version in all HTML files
for file in "${HTML_FILES[@]}"; do
  if [ -f "$file" ]; then
    sed -i "s|styles\.css?v=[a-zA-Z0-9_-]*|styles.css?v=$CSS_HASH|g" "$file"
    sed -i "s|enhancements\.js?v=[a-zA-Z0-9_-]*|enhancements.js?v=$JS_HASH|g" "$file"
    echo "Updated $file"
  fi
done

# Update service worker precache references
sed -i "s|styles\.css?v=[a-zA-Z0-9_-]*|styles.css?v=$CSS_HASH|g" sw.js
sed -i "s|enhancements\.js?v=[a-zA-Z0-9_-]*|enhancements.js?v=$JS_HASH|g" sw.js

# Bump service worker cache version so browsers pick up the new SW
# Extract current version number, increment it
CURRENT_SW_VERSION=$(grep -oP "caish-v\K\d+" sw.js | head -1)
CURRENT_RUNTIME_VERSION=$(grep -oP "caish-runtime-v\K\d+" sw.js | head -1)
NEW_SW_VERSION=$((CURRENT_SW_VERSION + 1))
NEW_RUNTIME_VERSION=$((CURRENT_RUNTIME_VERSION + 1))
sed -i "s|caish-v${CURRENT_SW_VERSION}'|caish-v${NEW_SW_VERSION}'|g" sw.js
sed -i "s|caish-runtime-v${CURRENT_RUNTIME_VERSION}|caish-runtime-v${NEW_RUNTIME_VERSION}|g" sw.js
echo "Updated sw.js (cache: v${CURRENT_SW_VERSION} -> v${NEW_SW_VERSION}, runtime: v${CURRENT_RUNTIME_VERSION} -> v${NEW_RUNTIME_VERSION})"

echo ""
echo "Done! Cache versions updated."
echo "  CSS:  ?v=$CSS_HASH"
echo "  JS:   ?v=$JS_HASH"
echo "  SW:   caish-v${NEW_SW_VERSION} / caish-runtime-v${NEW_RUNTIME_VERSION}"
