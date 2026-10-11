// Seamless looping player for /noise/. Uses the Web Audio API rather than
// <audio loop>, because the loop has to start and end at points inside the
// file rather than at its edges — see LOOP_SECONDS below — and because
// <audio loop> is not reliably gapless anyway.
(function () {
	"use strict";

	// The audio files hold LOOP_SECONDS of loopable material with roughly a
	// second of padding on either side. The padding is there because every
	// lossy codec reconstructs its first and last frames without the overlap
	// context of the surrounding audio, which leaves a small step at the
	// splice when the file is exactly one period long. Looping the inner
	// region keeps those boundary frames out of the loop.
	var LOOP_SECONDS = 316;

	// Ogg Opus first; Safari's support for it in decodeAudioData has been
	// unreliable, so an AAC copy follows as a fallback. Chosen by trying to
	// decode, not by canPlayType(), which has historically disagreed with
	// what decodeAudioData will actually accept.
	var SOURCES = ["/audio/brown-noise-loop.opus", "/audio/brown-noise-loop.m4a"];

	var FADE = 0.25;        // seconds; keeps the noise from clicking in or out
	var DEFAULT_VOLUME = 60;

	var ctx = null, buffer = null, source = null, gain = null;
	var suspendTimer = null, playing = false;
	var button, errorBox, volume;

	// The button is the only feedback the page gives, so it carries all three
	// states: idle, busy while the first press downloads and decodes, and
	// playing. Which icon shows is left to the stylesheet.
	function setState(state) {
		button.classList.toggle("is-busy", state === "busy");
		button.classList.toggle("is-playing", state === "playing");
		button.disabled = state === "busy";
		if (state === "busy") button.setAttribute("aria-busy", "true");
		else button.removeAttribute("aria-busy");
		button.setAttribute("aria-label", state === "playing" ? "Pause" : "Play");
	}

	function showError(message) {
		errorBox.textContent = message;
		errorBox.hidden = false;
	}

	function clearError() {
		errorBox.textContent = "";
		errorBox.hidden = true;
	}

	// Perceptual-ish taper, so the lower half of the slider stays useful.
	function sliderGain() {
		var x = Number(volume.value) / 100;
		return x * x;
	}

	function storeVolume() {
		try { localStorage.setItem("noise-volume", volume.value); } catch (e) {}
	}

	function restoreVolume() {
		var stored = null;
		try { stored = localStorage.getItem("noise-volume"); } catch (e) {}
		var n = stored === null ? NaN : Number(stored);
		volume.value = String(isFinite(n) && n >= 0 && n <= 100 ? n : DEFAULT_VOLUME);
	}

	function makeContext() {
		var AC = window.AudioContext || window.webkitAudioContext;
		if (!AC) return null;
		// A 24 kHz context halves the decoded buffer — about 58 MB instead of
		// 116 MB for five and a quarter minutes of stereo. The material keeps
		// 0.02% of its energy above 2 kHz, so a 12 kHz Nyquist costs nothing
		// audible. Not every engine honours a requested rate, hence the retry.
		try { return new AC({ sampleRate: 24000, latencyHint: "playback" }); } catch (e) {}
		try { return new AC(); } catch (e) { return null; }
	}

	// decodeAudioData returns a promise in current browsers and takes
	// callbacks in older ones; accept whichever the engine offers.
	function decode(data) {
		return new Promise(function (resolve, reject) {
			var returned;
			try {
				returned = ctx.decodeAudioData(data, resolve, reject);
			} catch (e) {
				reject(e);
				return;
			}
			if (returned && typeof returned.then === "function") {
				returned.then(resolve, reject);
			}
		});
	}

	function loadBuffer() {
		var index = 0;
		function attempt() {
			return fetch(SOURCES[index])
				.then(function (response) {
					if (!response.ok) throw new Error("HTTP " + response.status);
					return response.arrayBuffer();
				})
				.then(decode)
				.catch(function (error) {
					index += 1;
					if (index < SOURCES.length) return attempt();
					throw error;
				});
		}
		return attempt();
	}

	function fadeTo(value, seconds) {
		var now = ctx.currentTime;
		gain.gain.cancelScheduledValues(now);
		gain.gain.setValueAtTime(gain.gain.value, now);
		gain.gain.linearRampToValueAtTime(value, now + seconds);
	}

	function startSource() {
		source = ctx.createBufferSource();
		source.buffer = buffer;
		source.loop = true;
		// Split the difference between the decoded length and the loop length,
		// rather than assuming the padding is exactly a second. Decoders add
		// their own: Opus signals a 312-sample pre-skip, AAC leaves a few
		// milliseconds of trailing silence. Shifting both loop points by the
		// same amount keeps loopEnd - loopStart exactly LOOP_SECONDS, which is
		// the only figure that has to be right for the loop to stay seamless.
		var pad = (buffer.duration - LOOP_SECONDS) / 2;
		if (pad > 0) {
			source.loopStart = pad;
			source.loopEnd = pad + LOOP_SECONDS;
		}
		source.connect(gain);
		source.start(0, source.loopStart || 0);
	}

	function beginPlaying() {
		if (source === null) startSource();
		fadeTo(sliderGain(), FADE);
		setState("playing");
	}

	function play() {
		if (suspendTimer !== null) {
			clearTimeout(suspendTimer);
			suspendTimer = null;
		}
		if (ctx === null) {
			ctx = makeContext();
			if (ctx === null) {
				showError("This browser has no Web Audio support, so the loop cannot play.");
				button.disabled = true;
				return;
			}
			gain = ctx.createGain();
			gain.gain.value = 0;
			gain.connect(ctx.destination);
		}

		clearError();
		playing = true;

		var resumed = ctx.resume ? ctx.resume() : Promise.resolve();
		Promise.resolve(resumed).then(function () {
			if (buffer !== null) {
				beginPlaying();
				return;
			}
			setState("busy");
			loadBuffer().then(function (decoded) {
				buffer = decoded;
				if (!playing) {
					setState("idle");
					return;
				}
				beginPlaying();
			}).catch(function (error) {
				playing = false;
				setState("idle");
				showError("Could not load the audio — " +
					(error && error.message ? error.message : "unknown error") + ".");
			});
		});
	}

	function pause() {
		playing = false;
		setState("idle");
		if (ctx === null) return;
		fadeTo(0, FADE);
		// Suspending rather than stopping keeps the position, so resuming
		// picks the piece up where it left off instead of restarting it.
		suspendTimer = setTimeout(function () {
			suspendTimer = null;
			if (!playing && ctx && ctx.suspend) ctx.suspend();
		}, FADE * 1000 + 60);
	}

	function init() {
		button = document.getElementById("noise-toggle");
		errorBox = document.getElementById("noise-error");
		volume = document.getElementById("noise-volume");
		if (!button || !errorBox || !volume) return;

		restoreVolume();
		setState("idle");

		button.addEventListener("click", function () {
			if (playing) pause();
			else play();
		});

		volume.addEventListener("input", function () {
			storeVolume();
			if (ctx !== null && playing) fadeTo(sliderGain(), 0.05);
		});
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", init);
	} else {
		init();
	}
})();
