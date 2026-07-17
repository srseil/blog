#!/usr/bin/env bash

# This build script depends on pandoc and imagemagick

# Get the directory of the current script
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Count the Markdown files up front so we can show "[n/total]" progress
total=$(find docs -name '*.md' | wc -l | tr -d ' ')
count=0

echo "Building $total page(s)..."

for file in $(find docs -name '*.md'); do
    count=$((count + 1))
    dir="$(dirname "$file")"
    base="$(basename "$file")"

    printf '[%d/%d] %s -> %s\n' "$count" "$total" "$file" "${file%.md}.html"

    # Switch to the directory that contains the Markdown file
    (
      cd "$dir" || exit

      # Run pandoc from here so that relative paths to images work
      pandoc "$base" \
        -f markdown \
        -t html \
        --wrap=none \
        --template="$SCRIPT_DIR/template.html" \
	--syntax-highlighting=none \
        --lua-filter="$SCRIPT_DIR/image-dimensions.lua" \
        --lua-filter="$SCRIPT_DIR/heading-anchors.lua" \
        -o "${base%.md}.html"
    )
done

echo "Done."
