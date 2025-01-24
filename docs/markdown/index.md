---
title: "Markdown"
---

This page shows how Markdown ends up being rendered as HTML/CSS on this website.

# Headers

```
# h1 Heading
## h2 Heading
### h3 Heading
Normal text
```	

# h1 Heading
## h2 Heading
### h3 Heading
Normal text

# Emphasis

```
**This is bold text**

_This is italic text_

~~Strikethrough~~
```

**This is bold text**

_This is italic text_

~~Strikethrough~~

# Lists

```
* First unordered list item
* Second unordered list item
* Third unordered list item

1. First ordered list item
2. Second ordered list item
3. Third ordered list item

* List item one \
    With line break
    * Sublist item one
        * Subsublist item one
        * Subsublist item two
    * Sublist item two
        * Subsublist item one
        * Subsublist item two

1. List item one

    With additional paragraph attached

2. List item two

    With additional paragraph attached
```

* First unordered list item
* Second unordered list item
* Third unordered list item

1. First ordered list item
2. Second ordered list item
3. Third ordered list item

* List item one \
    With line break
    * Sublist item one
        * Subsublist item one
        * Subsublist item two
    * Sublist item two
        * Subsublist item one
        * Subsublist item two

1. List item one

    With additional paragraph attached

2. List item two

    With additional paragraph attached

# Links

```
[Inline link with title](https://stevie.blog "Stevie's Blog")

[Relative reference to a file](./index.md)

URLs in angle brackets are automatically turned into links: <https://stevie.blog>
```

[Inline link with title](https://stevie.blog "Stevie's Blog")

[Relative reference to a file](./index.md)

URLs in angle brackets are automatically turned into links: <https://stevie.blog>

# Images

```
Image with optional caption and title:

![An illustration of Longcat.](./longcat.jpg "Longcat")
```

Image with optional caption and title:

![An illustration of Longcat.](./longcat.jpg "Longcat")

# Footnotes

```
Footnote 1 link[^first].

Footnote 2 link[^second].

Duplicated footnote reference[^second].

[^first]: Footnotes **can have markup**.
    
    And multiple paragraphs.

[^second]: Footnote text.

Footnootes are automatically placed at the end of the document.
```

Footnote 1 link[^first].

Footnote 2 link[^second].

Duplicated footnote reference[^second].

[^first]: Footnotes **can have markup**.
    
    And multiple paragraphs.

[^second]: Footnote text.

Footnootes are automatically placed at the end of the document.

# Horizontal Rules

```
Three or more hyphens.

---

Some text after.
```

Three or more hyphens.

---

Some text after.

# Blockquotes

```
> Blockquotes are very handy to emulate reply text.
> This line is part of the same quote.

Quote break.

> This is a very long line that will still be quoted properly when it wraps. Let's keep writing to make sure this is long enough to actually wrap. You can even *put* **Markdown** into a blockquote.
```

> Blockquotes are very handy to emulate reply text.
> This line is part of the same quote.

Quote break.

> This is a very long line that will still be quoted properly when it wraps. Let's keep writing to make sure this is long enough to actually wrap. You can even *put* **Markdown** into a blockquote.

# Code

````
Inline `code` has `back-ticks around` it.

```
#include <stdio.h>

int main() {
    printf("Hello, World!\n");
    return 0;
}
```
````

Inline `code` has `back-ticks around` it.

```
#include <stdio.h>

int main() {
    printf("Hello, World!\n");
    return 0;
}
```

# Tables

```
Colons can be used to align columns.

| Tables        | Are           | Cool  |
| ------------- |:-------------:| -----:|
| col 3 is      | right-aligned | $1600 |
| col 2 is      | centered      |   $12 |
| zebra stripes | are neat      |    $1 |

There must be at least 3 dashes separating each header cell.
The outer pipes (|) are optional, and you don't need to make the
raw Markdown line up prettily. You can also use inline Markdown.

Markdown | Less | Pretty
--- | --- | ---
*Still* | `renders` | **nicely**
1 | 2 | 3

| First Header  | Second Header |
| ------------- | ------------- |
| Content Cell  | Content Cell  |
| Content Cell  | Content Cell  |

| Left-aligned | Center-aligned | Right-aligned |
| :---         |     :---:      |          ---: |
| git status   | git status     | git status    |
| git diff     | git diff       | git diff      |
```

Colons can be used to align columns.

| Tables        | Are           | Cool  |
| ------------- |:-------------:| -----:|
| col 3 is      | right-aligned | $1600 |
| col 2 is      | centered      |   $12 |
| zebra stripes | are neat      |    $1 |

There must be at least 3 dashes separating each header cell.
The outer pipes (|) are optional, and you don't need to make the
raw Markdown line up prettily. You can also use inline Markdown.

Markdown | Less | Pretty
--- | --- | ---
*Still* | `renders` | **nicely**
1 | 2 | 3

| First Header  | Second Header |
| ------------- | ------------- |
| Content Cell  | Content Cell  |
| Content Cell  | Content Cell  |

| Left-aligned | Center-aligned | Right-aligned |
| :---         |     :---:      |          ---: |
| git status   | git status     | git status    |
| git diff     | git diff       | git diff      |

# Inline HTML

```
<dl>
  <dt>Definition list</dt>
  <dd>Is something people use sometimes.</dd>

  <dt>Markdown in HTML</dt>
  <dd>Does apparently *also* work **pretty** well.</dd>
</dl>
```

<dl>
  <dt>Definition list</dt>
  <dd>Is something people use sometimes.</dd>

  <dt>Markdown in HTML</dt>
  <dd>Does apparently *also* work **pretty** well.</dd>
</dl>

# Ignoring Markdown Formatting

To ignore Markdown formatting, use \\ before the Markdown character.

```
Let's rename \*our-new-project\* to \*our-old-project\*.
```

Let's rename \*our-new-project\* to \*our-old-project\*.
