---
date: "January 24, 2025"
title: "Starting a Blog"
subtitle: "Keeping It Simple"
---

I have finally come around to creating my own personal blog, something which I've wanted to do for a long time. In doing so, I had to take some considerations that I want to share here.

# Simplicity

There are hundreds of ways one can create a blog on the internet. The conventional wisdom for a programmer like myself would probably be to choose one of the myriad of static site generators, pick a likeable theme and use Github Pages to host the result. While I did end up going with the latter part regarding the hosting, I chose to not use any static site generator, but instead to keep it simpler.

I got inspired by [fabiensanglard.net](https://fabiensanglard.net) and decided to build my blog based on his template and theme. I ended up changing quite a few things, and I am very happy with the results. The website is now made up of a few simple components:

* An HTML template file that is used for every page
* A CSS stylesheet also used for all pages
* Markdown files that describe the actual content of the pages
* A build script that turns the Markdown files into HTML documents

The Markdown files are converted with `pandoc`. I created a pandoc filter that uses `imagemagick` to add width and height attributes to `<img>` tags for smoother image loading. For convenience, I also added a [/markdown](/markdown) page for an overview of how Markdown ends up being rendered as HTML. All of this stuff can be found on [Github](https://github.com/srseil/blog).

# Style

I want my personal blog to be beautiful. I liked the pragmatic nature of [fabiensanglard.net](https://fabiensanglard.net) quite a bit, but decided to change some key aspects of it. The monospace font was replaced with four different fonts for the header navigation, headings, code blocks and normal text. I chose a combination of sans-serif and serif fonts as well as a color scheme from a webpage suitably titled [Best Google Fonts Pairings](https://www.pagecloud.com/blog/best-google-fonts-pairings), and found an additional font for the header navigation through [Typewolf](https://www.typewolf.com/site-of-the-day/jan-paul-koudstaal). I am quite happy with the design of the page, at least for now. The light gray with the blue accents makes it a bit cold, but then again this is January, so what are you supposed to do?

\

I'm not sure if it could be much simpler than that. Of course, there is always an endless number of things that can still be added. Like dark mode. And clickable header references. And an image viewer. And an RSS feed. And...
