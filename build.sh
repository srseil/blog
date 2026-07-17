#!/usr/bin/env bash

# This build script depends on pandoc and imagemagick

# Get the directory of the current script
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

for file in $(find docs -name '*.md'); do
    dir="$(dirname "$file")"
    base="$(basename "$file")"

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
        -o "${base%.md}.html"
    )
done
