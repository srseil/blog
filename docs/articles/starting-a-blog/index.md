---
date: "January 24, 2025"
title: "Starting a Blog"
subtitle: "Plans, Expectations and Keeping It Simple"
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

I'm not sure if it could be much simpler than that. Of course, there is always an endless number of things that can still be added. Like dark mode. And clickable header references. And an image viewer. And an RSS feed. And...

# Style

I want my personal blog to be beautiful. I liked the pragmatic nature of [fabiensanglard.net](https://fabiensanglard.net) quite a bit, but decided to change some key aspects of it. The monospace font was replaced with four different fonts for the header navigation, headings, code blocks and normal text. I chose a combination of sans-serif and serif fonts as well as a color scheme from a webpage suitably titled [Best Google Fonts Pairings](https://www.pagecloud.com/blog/best-google-fonts-pairings), and found an additional font for the header navigation through [Typewolf](https://www.typewolf.com/site-of-the-day/jan-paul-koudstaal). I am quite happy with the design of the page, at least for now. The light gray with the blue accents makes it a bit cold, but then again this is January, so what are you supposed to do?

# Writing

At the end of the day, any blog is only as interesting as what is written on it. One of my main motivations for doing this in the first place was to create a writing outlet for my ideas. I think it would help me a lot to attempt to write down, and hence put into words, some of the concepts that I am thinking about on a regular basis.

As a start, I want to write about my upcoming journey to create _Seaside_, a modern IDE for the C programming language. I imagine it to be like a devlog, writing down interesting design considerations, implementation details and generally keeping track of the progress I'm making. The last part is also an attempt to cope with the slow progress that working on big programming projects like this frequently entails. Not having sufficiently visible achievements, and not sharing the ones that occur, is something that has caused me trouble in the past.

# Photography

I already put up one of my (admittedly amateurish) photos on the root page of this blog. I've been wanting to get into photography more, and I can imagine uploading some of my better pictures to a gallery on this webpage. I was spending three months in the UK and USA last year, and upon coming back I wanted to share the photos I had made with some of my friends who were interested in seeing them. Having separate subpages for individual photo albums would be quite convenient in facilitating that, I could just send someone a link and they can look at them whenever they like.

# Sharing

When I think about how I got the idea for creating a blog in the first place, then it was because I got inspired by reading other people's articles that have been shared on Hacker News, Reddit or X (with subsequent discussions on these platforms). I wanted to share my ideas with the world in the same way, and get feedback through discussion. Don't we all want that? However, social media sites have become increasingly off-putting to me within the last couple of years. Nowadays, when I read a discussion of a blog article on one of the aforementioned sites, I wonder why so many commenters come off as dismissive, combative jerks. That part of the internet has truly become sad. Do I even want to get feedback from these kinds of people? Then again, there are always diamonds in the rough. So I will have to see how I handle this part.

Of course, the prerequisite is that someone is interested in my articles in the first place. And I think it's best to let go of any expectations around who is reading what I am writing. Or whether people like it. I want to do it for myself, and that's all it is supposed to be. That is good enough for me.
