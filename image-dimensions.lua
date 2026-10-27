-- docs/ (the web root) sits next to this filter. Root-relative image paths like
-- "/404.jpg" are resolved against it; others relative to the page being built.
local docs_root = (PANDOC_SCRIPT_FILE:match("^(.*)/[^/]*$") or ".") .. "/docs"

function Image(elem)
  local path = elem.src
  if path:sub(1, 1) == "/" then
    path = docs_root .. path
  end

  -- Call ImageMagick’s 'identify' directly
  local cmd = 'identify -format "%w %h" "' .. path .. '"'
  local handle = io.popen(cmd)
  local result = handle and handle:read("*a")
  if handle then handle:close() end
  
  if not result then
    return elem
  end
  
  local w, h = result:match("(%d+)%s+(%d+)")
  if w and h then
    elem.attributes.width = w
    elem.attributes.height = h
  end
  
  -- Clear the alt text only when the image has a caption: pandoc renders that
  -- caption as a visible <figcaption>, so keeping the alt would make screen
  -- readers announce the same text twice. Captionless images keep their alt
  -- so it can still serve as their accessible name.
  if #elem.caption > 0 then
    elem.attributes.alt = ""
  end
  
  return elem
end
