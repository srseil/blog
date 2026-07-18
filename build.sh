#!/usr/bin/env bash

# This build script depends on pandoc and imagemagick

set -o pipefail

# Get the directory of the current script
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Base URL of the deployed site (used for canonical links and the sitemap)
SITE_URL="https://srseil.com"

# Count the Markdown files up front so we can show "[n/total]" progress
total=$(find docs -name '*.md' | wc -l | tr -d ' ')
count=0
failures=0
sitemap_urls=()

echo "Building $total page(s)..."

# NUL-delimited loop so paths with spaces are handled safely. Process
# substitution keeps the loop in the current shell so counters persist.
while IFS= read -r -d '' file; do
    count=$((count + 1))
    dir="$(dirname "$file")"
    base="$(basename "$file")"
    out="${file%.md}.html"

    # Canonical URL derived from the directory (docs/ is the web root).
    rel="${dir#docs}"
    canonical="$SITE_URL$rel/"

    printf '[%d/%d] %s -> %s\n' "$count" "$total" "$file" "$out"

    # Run pandoc from the file's directory so relative image paths resolve.
    if (
      cd "$dir" || exit 1
      pandoc "$base" \
        -f markdown \
        -t html \
        --wrap=none \
        --template="$SCRIPT_DIR/template.html" \
        --syntax-highlighting=none \
        --metadata "canonical=$canonical" \
        --lua-filter="$SCRIPT_DIR/image-dimensions.lua" \
        --lua-filter="$SCRIPT_DIR/heading-anchors.lua" \
        -o "${base%.md}.html"
    ); then
      # Add to the sitemap unless the page opted out with `noindex`.
      if ! grep -q 'name="robots" content="noindex"' "$out"; then
        sitemap_urls+=("$canonical")
      fi
    else
      echo "  ✗ failed to build $file" >&2
      failures=$((failures + 1))
    fi
done < <(find docs -name '*.md' -print0)

# Generate sitemap.xml from the pages that built successfully.
{
    echo '<?xml version="1.0" encoding="UTF-8"?>'
    echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
    for url in "${sitemap_urls[@]}"; do
        echo "  <url><loc>$url</loc></url>"
    done
    echo '</urlset>'
} > docs/sitemap.xml
echo "Wrote docs/sitemap.xml (${#sitemap_urls[@]} URLs)."

if [ "$failures" -gt 0 ]; then
    echo "Done with $failures error(s)." >&2
    exit 1
fi

echo "Done."
