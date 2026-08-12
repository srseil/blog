/*
 * Private note editor for /notes/.
 *
 * A passphrase unlocks a "vault" — an AES-256-GCM blob committed to this repo
 * that holds a GitHub token, a gist ID, and a random data key. The note text
 * itself lives in that gist, encrypted with the data key, so the gist ID being
 * public here does not expose the note: GitHub's "secret" gists are unlisted,
 * not private, and anyone can read one if they know its ID.
 *
 * The data key is separate from the passphrase-derived key so that changing the
 * passphrase only re-encrypts the vault, never the note.
 *
 * Nothing decrypted is ever persisted — no storage, no cookies, no DOM
 * attributes. It lives in `session` until the page unloads, you hit Lock, or
 * the idle watchdog locks it for you.
 *
 * Generate CONFIG with notes-setup.html in the repo root (never deployed).
 */
(function () {
	"use strict";

	var CONFIG = {
		kdfIterations: 1000000,
		salt: "2ngIT16bn3vZD7+hfYnKuA==",
		iv: "WpC74DJxjFf3FJ2h",
		vault: "v+CqO7QS1j0SshVIJwj/2aDsCHJYyzylWe2ntHywNmPOGBMlAu6F6I/2TMItRG5LbPQhkWvqWrwfZF8ddEatIZDjMmzM7G8QKS/8FQFs2nbNMkq8WJfgTad6T1B/ZKuJZlPYbBrJpmkfqdF8FMGc5p9jpKcDF4a2tBUID9XQWgs96r9B+WJ/TkyaSFQYrerCf5Za2vG15p80WoJe45Xr5QMgxpALuQpL6sftLONgGb2rfvCA7tpEyXH84xWXjjAcKaypD7th3r7hrl1PD7FaAfAaSSQppZghYFHGkzFuFD+L7LwWjDSxjtDCRGO9JuVJcRs=",
	};

	var API = "https://api.github.com";
	var AUTOSAVE_MS = 2500;
	var IDLE_LOCK_MS = 15 * 60 * 1000;   // unattended session locks itself
	var IDLE_CHECK_MS = 15 * 1000;
	var CONFLICT_STATUS = "Conflict — not saving";

	var el = {};
	var session = null;   // { token, gistId, filename, dek, updatedAt }
	var dirty = false;
	var saving = false;
	var conflicted = false;
	var autosaveTimer = null;
	var pendingSave = null;   // in-flight save(), so Lock can wait on it
	var idleTimer = null;
	var lastActivity = 0;

	/* ---------- encoding helpers ---------- */

	var utf8 = new TextEncoder();
	var utf8Decode = new TextDecoder();

	function fromBase64(value) {
		var binary = atob(value);
		var bytes = new Uint8Array(binary.length);
		for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
		return bytes;
	}

	function toBase64(buffer) {
		var bytes = new Uint8Array(buffer);
		var binary = "";
		// Chunked so a large note cannot blow the argument limit on apply().
		for (var i = 0; i < bytes.length; i += 0x8000) {
			binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
		}
		return btoa(binary);
	}

	function randomBytes(count) {
		return crypto.getRandomValues(new Uint8Array(count));
	}

	/* ---------- crypto ---------- */

	// PBKDF2-SHA256 over the passphrase. Deliberately slow: this is the only
	// thing standing between a public ciphertext and the token inside it.
	function deriveVaultKey(passphrase) {
		return crypto.subtle.importKey(
			"raw", utf8.encode(passphrase), "PBKDF2", false, ["deriveKey"]
		).then(function (base) {
			return crypto.subtle.deriveKey(
				{
					name: "PBKDF2",
					salt: fromBase64(CONFIG.salt),
					iterations: CONFIG.kdfIterations,
					hash: "SHA-256",
				},
				base,
				{ name: "AES-GCM", length: 256 },
				false,
				["decrypt"]
			);
		});
	}

	function openVault(passphrase) {
		return deriveVaultKey(passphrase).then(function (key) {
			// A wrong passphrase fails the GCM auth tag, so this rejects rather
			// than handing back garbage.
			return crypto.subtle.decrypt(
				{ name: "AES-GCM", iv: fromBase64(CONFIG.iv) },
				key,
				fromBase64(CONFIG.vault)
			);
		}).then(function (plaintext) {
			var vault = JSON.parse(utf8Decode.decode(plaintext));
			return crypto.subtle.importKey(
				"raw", fromBase64(vault.dek), "AES-GCM", false, ["encrypt", "decrypt"]
			).then(function (dek) {
				return {
					token: vault.token,
					gistId: vault.gistId,
					filename: vault.filename || "notes.json",
					dek: dek,
					updatedAt: null,
				};
			});
		});
	}

	// The note is stored in the gist as {"v":1,"iv":...,"ct":...}, base64 fields.
	function encryptNote(text) {
		var iv = randomBytes(12);
		return crypto.subtle.encrypt(
			{ name: "AES-GCM", iv: iv }, session.dek, utf8.encode(text)
		).then(function (ct) {
			return JSON.stringify({ v: 1, iv: toBase64(iv), ct: toBase64(ct) }) + "\n";
		});
	}

	function decryptNote(raw) {
		var envelope;
		try {
			envelope = JSON.parse(raw);
		} catch (e) {
			envelope = null;
		}
		if (!envelope || envelope.v !== 1 || !envelope.iv || !envelope.ct) {
			return Promise.reject(new Error(
				"The gist file is not in the expected encrypted format. Refusing to " +
				"load it so a save cannot overwrite whatever it actually contains."
			));
		}
		return crypto.subtle.decrypt(
			{ name: "AES-GCM", iv: fromBase64(envelope.iv) }, session.dek, fromBase64(envelope.ct)
		).then(function (plaintext) {
			return utf8Decode.decode(plaintext);
		}).catch(function () {
			throw new Error("The note could not be decrypted — the data key does not match this gist.");
		});
	}

	/* ---------- GitHub API ---------- */

	function api(token, path, options) {
		options = options || {};
		var headers = {
			Authorization: "Bearer " + token,
			Accept: "application/vnd.github+json",
			"X-GitHub-Api-Version": "2022-11-28",
		};
		if (options.body) headers["Content-Type"] = "application/json";

		return fetch(API + path, {
			method: options.method || "GET",
			headers: headers,
			body: options.body ? JSON.stringify(options.body) : undefined,
			cache: "no-store",
		}).catch(function () {
			throw new Error("Network error — no connection to the GitHub API.");
		}).then(function (response) {
			if (response.ok) return response.json();
			if (response.status === 401) {
				throw new Error("401 — the GitHub token was revoked or is invalid.");
			}
			if (response.status === 403 || response.status === 429) {
				throw new Error("403 — forbidden or rate limited. If this persists, the token may lack gist access.");
			}
			if (response.status === 404) {
				throw new Error("404 — no such gist, or this token cannot see it.");
			}
			throw new Error("GitHub returned " + response.status + ".");
		});
	}

	function fetchGist() {
		return api(session.token, "/gists/" + encodeURIComponent(session.gistId));
	}

	function readGistFile(gist) {
		var files = gist.files || {};
		var file = files[session.filename];
		if (!file) {
			var names = Object.keys(files);
			// Tolerate a renamed file as long as there is exactly one candidate.
			if (names.length === 1) {
				session.filename = names[0];
				file = files[names[0]];
			}
		}
		if (file && file.truncated) {
			throw new Error(
				"The gist file is over 1 MB and came back truncated. Refusing to load " +
				"it, because saving would destroy the part that was cut off."
			);
		}
		return file;
	}

	/* ---------- view state ---------- */

	function setStatus(text, kind) {
		el.status.textContent = text;
		if (kind) el.status.setAttribute("data-kind", kind);
		else el.status.removeAttribute("data-kind");
	}

	function showMessage(text, withActions) {
		el.messageText.textContent = text;
		el.message.hidden = false;
		el.messageActions.hidden = !withActions;
	}

	function clearMessage() {
		el.message.hidden = true;
		el.messageActions.hidden = true;
		el.messageText.textContent = "";
	}

	// While conflicted, save() refuses to write, so the status must keep saying
	// so — otherwise typing looks normal while nothing at all is being stored.
	function setDirty(value) {
		dirty = value;
		if (conflicted) setStatus(CONFLICT_STATUS, "error");
		else setStatus(value ? "Unsaved changes" : "Saved");
	}

	function showEditor() {
		el.unlock.hidden = true;
		el.editor.hidden = false;
	}

	// Throws away the decrypted note, the data key and the token. Everything
	// unsaved is gone at this point, so only call it once that is settled.
	function clearSession() {
		clearTimeout(autosaveTimer);
		stopIdleWatch();
		session = null;
		dirty = false;
		saving = false;
		conflicted = false;
		pendingSave = null;
		el.text.value = "";
		renderHighlight();
		el.editor.hidden = true;
		el.unlock.hidden = false;
		el.passphrase.value = "";
		clearMessage();
		setStatus("");
		el.passphrase.focus();
	}

	// Lock is the one exit `beforeunload` does not cover, and it wipes the
	// textarea, so unsaved work has to be dealt with before the session goes.
	function lock() {
		if (!session || !dirty) {
			clearSession();
			return;
		}

		// A conflict makes save() refuse to write, so there is nothing to try:
		// either resolve it with the buttons already on screen, or say plainly
		// that the local text is being thrown away.
		if (conflicted) {
			if (confirm(
				"This note has unsaved changes, and a conflicting version exists on " +
				"GitHub.\n\nLock anyway and discard your unsaved changes?"
			)) {
				clearSession();
			}
			return;
		}

		el.lock.disabled = true;
		save(false).then(function (stored) {
			el.lock.disabled = false;
			// `dirty` is rechecked because more text can land while the PATCH is
			// in flight; save() only promises to have stored the earlier snapshot.
			if (stored && !dirty) {
				clearSession();
				return;
			}
			// save() has already reported why in the message box.
			if (confirm("There are still unsaved changes.\n\nLock anyway and discard them?")) {
				clearSession();
			} else {
				setStatus("Not locked — unsaved", "error");
			}
		});
	}

	/* ---------- link highlighting ---------- */

	// A textarea cannot contain elements, so the links are drawn on a div sitting
	// behind it with identical metrics, and the textarea renders its own text
	// transparently on top. Nothing here touches the note's contents — the
	// textarea remains the single source of truth for what gets encrypted.
	var URL_PATTERN = /\bhttps?:\/\/[^\s<>"']+/g;

	function escapeHtml(text) {
		return text.replace(/[&<>]/g, function (ch) {
			return ch === "&" ? "&amp;" : ch === "<" ? "&lt;" : "&gt;";
		});
	}

	// Trailing punctuation is far more often sentence furniture than part of the
	// address, so it gets trimmed back off the match.
	function trimUrl(match) {
		return match.replace(/[.,;:!?)\]}'"]+$/, "");
	}

	function renderHighlight() {
		var text = el.text.value;
		var html = "";
		var last = 0;
		var match;
		URL_PATTERN.lastIndex = 0;
		while ((match = URL_PATTERN.exec(text)) !== null) {
			var url = trimUrl(match[0]);
			html += escapeHtml(text.slice(last, match.index));
			html += '<span class="notes-link">' + escapeHtml(url) + "</span>";
			last = match.index + url.length;
		}
		html += escapeHtml(text.slice(last));
		// A textarea keeps a final empty line; a div needs coaxing to do the same.
		if (html.slice(-1) === "\n") html += " ";
		el.highlight.innerHTML = html;
		syncHighlightScroll();
	}

	function syncHighlightScroll() {
		el.highlight.scrollTop = el.text.scrollTop;
		el.highlight.scrollLeft = el.text.scrollLeft;
	}

	// Where the pointer is, and whether a modifier is down — tracked because the
	// cursor has to change when either one changes, including when the key is
	// pressed with the mouse sitting still.
	var pointer = { x: 0, y: 0, inside: false, modified: false };

	// The overlay already holds the links as real elements in the right place, so
	// hit-testing their rects beats mapping pixels back to a character index.
	// getClientRects returns one rect per line box, so a URL broken across a wrap
	// still answers for both halves.
	function linkUnderPointer() {
		var spans = el.highlight.querySelectorAll(".notes-link");
		for (var i = 0; i < spans.length; i++) {
			var rects = spans[i].getClientRects();
			for (var j = 0; j < rects.length; j++) {
				var rect = rects[j];
				if (pointer.x >= rect.left && pointer.x <= rect.right &&
					pointer.y >= rect.top && pointer.y <= rect.bottom) return true;
			}
		}
		return false;
	}

	// The pointer is over the textarea, never the overlay, so the affordance has
	// to be set on the textarea itself.
	function updateLinkCursor() {
		el.text.classList.toggle("is-link-hover",
			pointer.modified && pointer.inside && linkUnderPointer());
	}

	// The click has already moved the caret by the time this runs, so
	// selectionStart is exactly where the pointer landed.
	function urlAtCaret() {
		var text = el.text.value;
		var caret = el.text.selectionStart;
		var match;
		URL_PATTERN.lastIndex = 0;
		while ((match = URL_PATTERN.exec(text)) !== null) {
			var url = trimUrl(match[0]);
			if (caret >= match.index && caret <= match.index + url.length) return url;
		}
		return null;
	}

	/* ---------- idle auto-lock ---------- */

	// Compared against the wall clock rather than trusted to a plain timer: a
	// backgrounded tab throttles timers hard, and a phone that slept for an hour
	// has to come back already locked, not with the full countdown still to run.
	function noteActivity() {
		lastActivity = Date.now();
	}

	function startIdleWatch() {
		noteActivity();
		stopIdleWatch();
		idleTimer = setInterval(checkIdle, IDLE_CHECK_MS);
	}

	function stopIdleWatch() {
		clearInterval(idleTimer);
		idleTimer = null;
	}

	function checkIdle() {
		if (!session) {
			stopIdleWatch();
			return;
		}
		if (Date.now() - lastActivity >= IDLE_LOCK_MS) autoLock();
	}

	// Nobody is watching by definition, so this never asks a question — a
	// confirm() would just sit there unanswered. It saves, and locks only if the
	// save landed: leaving a session open is a smaller harm than dropping a note
	// that no one is present to rescue.
	function autoLock() {
		stopIdleWatch();
		var reason = "Locked automatically after " +
			Math.round(IDLE_LOCK_MS / 60000) + " minutes without activity.";

		if (!dirty) {
			clearSession();
			showMessage(reason);
			return;
		}

		save(false).then(function (stored) {
			if (stored && !dirty) {
				clearSession();
				showMessage(reason);
				return;
			}
			// Could not be stored — keep the text and try again next time round.
			setStatus("Idle — still unsaved", "error");
			startIdleWatch();
		});
	}

	/* ---------- unlock ---------- */

	function unlock(event) {
		event.preventDefault();
		if (!CONFIG.vault) {
			showMessage("This page has not been configured yet — CONFIG in notes.js is still empty. Run notes-setup.html to generate it.", false);
			return;
		}

		var passphrase = el.passphrase.value;
		el.unlockButton.disabled = true;
		el.unlockButton.textContent = "Unlocking…";
		clearMessage();

		// Yield before PBKDF2 so the button repaints first. A frame gives the
		// cleanest paint, but requestAnimationFrame never fires while the tab is
		// in the background — submit and switch away, and the unlock would be
		// stranded on "Unlocking…" forever — so a timer races it, and whichever
		// arrives first starts the work.
		var started = false;
		function begin() {
			if (started) return;
			started = true;
			openVault(passphrase).then(function (opened) {
				session = opened;
				el.passphrase.value = "";
				showEditor();
				startIdleWatch();
				// loadNote reports its own failures; the editor stays open so
				// Lock and a retry are still reachable.
				return loadNote().catch(function () {});
			}, function (error) {
				// A wrong passphrase fails the GCM tag as an OperationError.
				session = null;
				showMessage(error.name === "OperationError"
					? "Wrong passphrase."
					: "Could not open the vault: " + error.message);
			}).then(function () {
				el.unlockButton.disabled = false;
				el.unlockButton.textContent = "Unlock";
			});
		}
		requestAnimationFrame(begin);
		setTimeout(begin, 50);
	}

	function loadNote() {
		setStatus("Loading…");
		return fetchGist().then(function (gist) {
			session.updatedAt = gist.updated_at;
			var file = readGistFile(gist);
			if (!file) {
				// Empty gist — start blank and let the first save create the file.
				el.text.value = "";
				renderHighlight();
				setDirty(false);
				setStatus("New note");
				return;
			}
			return decryptNote(file.content).then(function (text) {
				el.text.value = text;
				renderHighlight();
				conflicted = false;
				setDirty(false);
				clearMessage();
				el.text.focus();
			});
		}).catch(function (error) {
			setStatus("Could not load", "error");
			showMessage(error.message);
			throw error;
		});
	}

	/* ---------- saving ---------- */

	// Resolves to true only once the note has actually reached GitHub, so a
	// caller that is about to discard the plaintext can tell whether that is safe.
	function save(force) {
		if (saving) return pendingSave;
		if (conflicted && !force) return Promise.resolve(false);

		clearTimeout(autosaveTimer);
		saving = true;
		var text = el.text.value;
		var stored = false;
		setStatus("Saving…");

		// Re-read before writing: this is edited from more than one device, and
		// a blind PATCH is last-write-wins.
		pendingSave = fetchGist().then(function (gist) {
			if (!force && session.updatedAt && gist.updated_at !== session.updatedAt) {
				conflicted = true;
				setStatus(CONFLICT_STATUS, "error");
				showMessage(
					"This note was changed somewhere else since you loaded it, so nothing " +
					"is being saved until you choose. Both options are permanent: one " +
					"replaces the version on GitHub, the other throws away the text in " +
					"front of you.", true
				);
				return null;
			}
			return encryptNote(text);
		}).then(function (payload) {
			if (payload === null) return null;
			var files = {};
			files[session.filename] = { content: payload };
			return api(session.token, "/gists/" + encodeURIComponent(session.gistId), {
				method: "PATCH",
				body: { files: files },
			});
		}).then(function (updated) {
			if (updated === null) return;
			session.updatedAt = updated.updated_at;
			conflicted = false;
			clearMessage();
			// Anything typed while the request was in flight stays unsaved.
			dirty = el.text.value !== text;
			setStatus(dirty ? "Unsaved changes" : "Saved");
			stored = true;
		}).catch(function (error) {
			setStatus("Could not save", "error");
			showMessage(error.message);
		}).then(function () {
			saving = false;
			pendingSave = null;
			return stored;
		});
		return pendingSave;
	}

	function scheduleAutosave() {
		clearTimeout(autosaveTimer);
		autosaveTimer = setTimeout(function () { save(false); }, AUTOSAVE_MS);
	}

	/* ---------- wiring ---------- */

	function init() {
		el = {
			unlock: document.getElementById("notes-unlock"),
			passphrase: document.getElementById("notes-passphrase"),
			unlockButton: document.getElementById("notes-unlock-button"),
			editor: document.getElementById("notes-editor"),
			text: document.getElementById("notes-text"),
			highlight: document.getElementById("notes-highlight"),
			status: document.getElementById("notes-status"),
			save: document.getElementById("notes-save"),
			lock: document.getElementById("notes-lock"),
			message: document.getElementById("notes-message"),
			messageText: document.getElementById("notes-message-text"),
			messageActions: document.getElementById("notes-message-actions"),
			overwrite: document.getElementById("notes-overwrite"),
			reload: document.getElementById("notes-reload"),
		};

		if (!window.crypto || !crypto.subtle) {
			el.unlock.hidden = true;
			showMessage("This browser does not expose crypto.subtle. It needs a secure context — open the page over HTTPS.");
			return;
		}

		el.unlock.addEventListener("submit", unlock);
		el.save.addEventListener("click", function () { save(false); });
		el.lock.addEventListener("click", lock);
		el.overwrite.addEventListener("click", function () { save(true); });
		// The destructive half of the conflict pair: the local text exists nowhere
		// else, so once loadNote() overwrites the textarea it cannot come back.
		el.reload.addEventListener("click", function () {
			if (dirty && !confirm(
				"This throws away the text in front of you and loads the version from " +
				"GitHub instead. Your unsaved changes cannot be recovered.\n\nDiscard them?"
			)) return;
			conflicted = false;
			loadNote().catch(function () {});
		});

		el.text.addEventListener("input", function () {
			setDirty(true);
			renderHighlight();
			updateLinkCursor();
			scheduleAutosave();
		});

		el.text.addEventListener("scroll", function () {
			syncHighlightScroll();
			// The pointer has not moved, but the text under it has.
			updateLinkCursor();
		});

		el.text.addEventListener("mousemove", function (event) {
			pointer.x = event.clientX;
			pointer.y = event.clientY;
			pointer.inside = true;
			pointer.modified = event.metaKey || event.ctrlKey;
			updateLinkCursor();
		});

		el.text.addEventListener("mouseleave", function () {
			pointer.inside = false;
			updateLinkCursor();
		});

		// Pressing or releasing the modifier without moving the mouse has to
		// flip the cursor too.
		document.addEventListener("keydown", function (event) {
			if (event.key === "Meta" || event.key === "Control") {
				pointer.modified = true;
				updateLinkCursor();
			}
		});

		document.addEventListener("keyup", function (event) {
			if (event.key === "Meta" || event.key === "Control") {
				pointer.modified = false;
				updateLinkCursor();
			}
		});

		// Switching away can swallow the keyup, stranding the pointer cursor.
		window.addEventListener("blur", function () {
			pointer.modified = false;
			updateLinkCursor();
		});

		// Cmd/Ctrl-click opens the URL under the pointer. Restricted to http(s)
		// by the pattern itself, so a note can never smuggle in a javascript: URL.
		el.text.addEventListener("click", function (event) {
			if (!event.metaKey && !event.ctrlKey) return;
			var url = urlAtCaret();
			if (url) window.open(url, "_blank", "noopener,noreferrer");
		});

		// Ctrl/Cmd-S saves, as the muscle memory expects.
		el.text.addEventListener("keydown", function (event) {
			if ((event.metaKey || event.ctrlKey) && event.key === "s") {
				event.preventDefault();
				save(false);
			}
		});

		// Any of these mean someone is still here. visibilitychange deliberately
		// does not count: a tab left in the background is precisely the case the
		// idle lock exists for.
		["keydown", "pointerdown", "input"].forEach(function (name) {
			document.addEventListener(name, noteActivity, { passive: true });
		});

		// Backgrounding the tab is the usual way a phone edit gets abandoned.
		document.addEventListener("visibilitychange", function () {
			if (document.visibilityState === "hidden") {
				if (session && dirty) save(false);
			} else if (session) {
				// Timers may have been throttled or frozen while away, so settle
				// any lock that came due in the meantime before showing the note.
				checkIdle();
			}
		});

		window.addEventListener("beforeunload", function (event) {
			if (!dirty) return;
			event.preventDefault();
			event.returnValue = "";
		});

		el.passphrase.focus();
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", init);
	} else {
		init();
	}
})();
