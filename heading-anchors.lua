function Header(el)
  if el.identifier and el.identifier ~= "" then
    local attr = pandoc.Attr("", { "anchor" }, { { "aria-hidden", "true" }, { "tabindex", "-1" } })
    local link = pandoc.Link({ pandoc.Str("#") }, "#" .. el.identifier, "", attr)
    el.content:insert(link)
  end
  return el
end
