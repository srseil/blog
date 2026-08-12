---
title: "Notes"
noindex: true
---

<div class="notes-app">
<form id="notes-unlock" class="notes-unlock">
<label class="notes-label" for="notes-passphrase">Passphrase</label>
<input id="notes-passphrase" class="notes-input" type="password" autocomplete="current-password" spellcheck="false" autocapitalize="none" autocorrect="off" required />
<button id="notes-unlock-button" class="notes-button" type="submit">Unlock</button>
</form>
<div id="notes-editor" class="notes-editor" hidden>
<div class="notes-toolbar">
<button id="notes-save" class="notes-button" type="button">Save</button>
<button id="notes-lock" class="notes-button" type="button">Lock</button>
<div id="notes-status" class="notes-status" role="status" aria-live="polite"></div>
</div>
<div class="notes-text-wrap">
<div id="notes-highlight" class="notes-highlight" aria-hidden="true"></div>
<textarea id="notes-text" class="notes-text" spellcheck="false" autocapitalize="sentences" autocorrect="off" aria-label="Note" title="Cmd/Ctrl-click a link to open it"></textarea>
</div>
</div>
<div id="notes-message" class="notes-message" role="alert" hidden>
<p id="notes-message-text"></p>
<div id="notes-message-actions" class="notes-message-actions" hidden>
<button id="notes-overwrite" class="notes-button" type="button">Overwrite remote with mine</button>
<button id="notes-reload" class="notes-button" type="button">Discard mine, keep remote</button>
</div>
</div>
<noscript><p class="notes-message">This page needs JavaScript.</p></noscript>
</div>

<script src="notes.js" defer></script>
