---
title: "Noise"
subtitle: "Brown noise with ambient piano"
description: "Brown noise with ambient piano."
---

<div class="noise-player">
<div class="noise-controls"><button id="noise-toggle" class="noise-button" type="button" aria-label="Play"><svg class="noise-icon-play" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg><svg class="noise-icon-pause" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg><svg class="noise-icon-busy" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M12 3a9 9 0 1 0 9 9"/></svg></button> <label class="noise-volume-label" for="noise-volume">Volume</label> <input id="noise-volume" class="noise-volume" type="range" min="0" max="100" step="1" value="60" /></div>
<p id="noise-error" class="noise-error" role="alert" hidden></p>
<noscript><p class="noise-error">This page needs JavaScript to play the loop.</p></noscript>
</div>

<script src="noise.js" defer></script>
