function Image(elem)
  -- Call ImageMagick’s 'identify' directly
  local cmd = 'identify -format "%w %h" "' .. elem.src .. '"'
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
  
  elem.attributes.alt = ""
  
  return elem
end
