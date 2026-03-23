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

hash_file() {
  local file="$1"

  if command -v md5sum >/dev/null 2>&1; then
    md5sum "$file" | awk '{print substr($1, 1, 8)}'
    return
  fi

  if command -v md5 >/dev/null 2>&1; then
    md5 -q "$file" | cut -c1-8
    return
  fi

  echo "No MD5 tool found. Install md5sum or use a system with md5 available." >&2
  exit 1
}

replace_in_file() {
  local file="$1"
  perl -0pi -e "s|styles\\.css\\?v=[a-zA-Z0-9_-]*|styles.css?v=$CSS_HASH|g; s|enhancements\\.js\\?v=[a-zA-Z0-9_-]*|enhancements.js?v=$JS_HASH|g" "$file"
}

# Generate short content hashes (first 8 chars of md5)
CSS_HASH=$(hash_file styles.css)
JS_HASH=$(hash_file enhancements.js)

echo "styles.css    hash: $CSS_HASH"
echo "enhancements.js hash: $JS_HASH"

# Files that reference styles.css and enhancements.js
HTML_FILES=(index.html about.html fellowship.html events.html mars.html desk.html research.html verify.html privacy.html terms.html video.html hannes.html cam.html)

# Update CSS version in all HTML files
for file in "${HTML_FILES[@]}"; do
  if [ -f "$file" ]; then
    replace_in_file "$file"
    echo "Updated $file"
  fi
done

# Update service worker precache references
replace_in_file sw.js

# Bump service worker cache version so browsers pick up the new SW
# Extract current version number, increment it
CURRENT_SW_VERSION=$(grep -Eo "caish-v[0-9]+" sw.js | head -1 | grep -Eo "[0-9]+")
CURRENT_RUNTIME_VERSION=$(grep -Eo "caish-runtime-v[0-9]+" sw.js | head -1 | grep -Eo "[0-9]+")
NEW_SW_VERSION=$((CURRENT_SW_VERSION + 1))
NEW_RUNTIME_VERSION=$((CURRENT_RUNTIME_VERSION + 1))
perl -0pi -e "s|caish-v${CURRENT_SW_VERSION}'|caish-v${NEW_SW_VERSION}'|g; s|caish-runtime-v${CURRENT_RUNTIME_VERSION}|caish-runtime-v${NEW_RUNTIME_VERSION}|g" sw.js
echo "Updated sw.js (cache: v${CURRENT_SW_VERSION} -> v${NEW_SW_VERSION}, runtime: v${CURRENT_RUNTIME_VERSION} -> v${NEW_RUNTIME_VERSION})"

echo ""
echo "Done! Cache versions updated."
echo "  CSS:  ?v=$CSS_HASH"
echo "  JS:   ?v=$JS_HASH"
echo "  SW:   caish-v${NEW_SW_VERSION} / caish-runtime-v${NEW_RUNTIME_VERSION}"
